const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { createServer } = require('http');
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');

const app = express();
const pubsub = new PubSub();

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:3000', // API Gateway
    'http://localhost:3002', // Frontend
    'http://api-gateway:3000', // Docker container name
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// In-memory data store (replace with real database in production)
let tasks = [
  // Task contoh (milik admin)
  {
    id: '1',
    title: 'Tugas Admin',
    description: 'Ini tugas awal',
    status: 'BACKLOG',
    assigneeId: 'admin-1', 
    teamId: 'team1',
    creatorId: 'admin-1', // <-- Field baru
    createdAt: new Date().toISOString(),
  }
];

// 1. Update Schema GraphQL
const typeDefs = `
  enum TaskStatus {
    BACKLOG
    TODO
    IN_PROGRESS
    DONE
  }

  type Task {
    id: ID!
    title: String!
    description: String
    status: TaskStatus!
    assigneeId: ID
    teamId: ID!
    creatorId: ID!  # <-- Field baru untuk tracking pemilik
    createdAt: String!
  }

  type Query {
    tasks(teamId: ID!): [Task!]!
    task(id: ID!): Task
  }

  type Mutation {
    createTask(teamId: ID!, title: String!, description: String): Task!
    updateTaskStatus(id: ID!, status: TaskStatus!): Task!
    
    # Mutation baru untuk menghapus
    deleteTask(id: ID!): Boolean! 
  }

  type Subscription {
    taskAdded(teamId: ID!): Task!
    taskUpdated(teamId: ID!): Task!
    taskDeleted(teamId: ID!): ID! # Notifikasi delete
  }
`;

const TASK_ADDED = 'TASK_ADDED';
const TASK_UPDATED = 'TASK_UPDATED';
const TASK_DELETED = 'TASK_DELETED'; // Event baru

// 2. Update Resolvers
const resolvers = {
  Query: {
    tasks: (_, { teamId }) => tasks.filter(task => task.teamId === teamId),
    task: (_, { id }) => tasks.find(task => task.id === id),
  },

  Mutation: {
    createTask: (_, { teamId, title, description }, { user }) => {
      // Cek login
      if (!user) throw new Error('Anda harus login untuk membuat task');

      const newTask = {
        id: uuidv4(),
        teamId,
        title,
        description: description || '',
        status: 'BACKLOG',
        assigneeId: user.id, // Otomatis assign ke diri sendiri
        creatorId: user.id,  // <-- SIMPAN PEMBUATNYA
        createdAt: new Date().toISOString(),
      };
      tasks.push(newTask);
      
      pubsub.publish(TASK_ADDED, { taskAdded: newTask });
      return newTask;
    },

    updateTaskStatus: (_, { id, status }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) throw new Error('Task not found');

      tasks[taskIndex].status = status;
      const updatedTask = tasks[taskIndex];

      pubsub.publish(TASK_UPDATED, { taskUpdated: updatedTask });
      return updatedTask;
    },
    
    // --- LOGIKA DELETE DENGAN OTORISASI ---
    deleteTask: (_, { id }, { user }) => {
      // 1. Cek Login
      if (!user) throw new Error('Unauthorized: Harap login');

      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) throw new Error('Task not found');
      
      const task = tasks[taskIndex];

      // 2. LOGIKA OTORISASI (Authorization)
      const isAdmin = user.role === 'admin';
      const isOwner = task.creatorId === user.id;

      // Jika BUKAN admin DAN BUKAN pemilik, tolak!
      if (!isAdmin && !isOwner) {
        throw new Error('Forbidden: Anda tidak berhak menghapus task ini!');
      }

      // 3. Hapus Task
      const teamId = task.teamId;
      tasks.splice(taskIndex, 1);

      // Notifikasi real-time
      pubsub.publish('TASK_DELETED', { taskDeleted: id, teamId }); // Pastikan event name string-nya sama dengan di Subscription
      
      return true;
    },
  },

  Subscription: {
    taskAdded: {
      subscribe: (parent, { teamId }) => pubsub.asyncIterator(TASK_ADDED),
      resolve: (payload) => payload.taskAdded,
    },
    taskUpdated: {
      subscribe: (parent, { teamId }) => pubsub.asyncIterator(TASK_UPDATED),
      resolve: (payload) => payload.taskUpdated,
    },
    taskDeleted: {
      // Filter notifikasi berdasarkan teamId
      subscribe: (parent, { teamId }) => pubsub.asyncIterator(TASK_DELETED),
      resolve: (payload) => payload.taskDeleted
    }
  },
};

async function startServer() {
  // Buat skema (menggabungkan typeDefs dan resolvers)
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Buat HTTP server
  const httpServer = createServer(app);

  // Buat WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql', // Sesuaikan dengan path endpoint GraphQL Anda
  });

  // Setup server subscription (menggunakan schema)
  const serverCleanup = useServer({ schema }, wsServer);

  // Buat Apollo Server dengan plugin
  const server = new ApolloServer({
    schema,
    context: ({ req }) => {
      // Terima header auth dari API Gateway
      const user = req.headers['x-user'] ? JSON.parse(req.headers['x-user']) : null;
      return { user, pubsub };
    },
    plugins: [
      // Plugin untuk mematikan HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),

      // Plugin untuk membersihkan koneksi subscription
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;

  // Jalankan HTTP server (bukan app.listen lagi)
  httpServer.listen(PORT, () => {
    console.log(`🚀 GraphQL API Server running on port ${PORT}`);
    console.log(`🚀 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Process terminated');
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'graphql-api (Task Service)',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('GraphQL API Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});