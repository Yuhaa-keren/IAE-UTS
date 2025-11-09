const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

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
  {
    id: '1',
    title: 'Desain UI/UX',
    description: 'Selesaikan desain untuk halaman login',
    status: 'BACKLOG', // BACKLOG, TODO, IN_PROGRESS, DONE
    assigneeId: '1',
    teamId: 'team1',
    createdAt: new Date().toISOString(),
  }
];

// GraphQL type definitions
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
    createdAt: String!
  }

  type Query {
    # Dapatkan semua task untuk satu tim
    tasks(teamId: ID!): [Task!]!
    # Dapatkan satu task spesifik
    task(id: ID!): Task
  }

  type Mutation {
    createTask(teamId: ID!, title: String!, description: String): Task!
    updateTaskStatus(id: ID!, status: TaskStatus!): Task!
    assignTask(id: ID!, assigneeId: ID!): Task!
  }

  type Subscription {
    # Terjadi ketika task baru dibuat
    taskAdded(teamId: ID!): Task!
    # Terjadi ketika status task berubah
    taskUpdated(teamId: ID!): Task!
  }
`;

const TASK_ADDED = 'TASK_ADDED';
const TASK_UPDATED = 'TASK_UPDATED';

// GraphQL resolvers
const resolvers = {
  Query: {
    tasks: (_, { teamId }) => tasks.filter(task => task.teamId === teamId),
    task: (_, { id }) => tasks.find(task => task.id === id),
  },

  Mutation: {
    createTask: (_, { teamId, title, description }) => {
      const newTask = {
        id: uuidv4(),
        teamId,
        title,
        description: description || '',
        status: 'BACKLOG',
        assigneeId: null,
        createdAt: new Date().toISOString(),
      };
      tasks.push(newTask);
      
      // Publish ke subscription
      pubsub.publish(TASK_ADDED, { taskAdded: newTask });
      
      return newTask;
    },

    updateTaskStatus: (_, { id, status }) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) throw new Error('Task not found');

      tasks[taskIndex].status = status;
      const updatedTask = tasks[taskIndex];

      // Publish ke subscription
      pubsub.publish(TASK_UPDATED, { taskUpdated: updatedTask });
      
      return updatedTask;
    },
    
    assignTask: (_, { id, assigneeId }) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) throw new Error('Task not found');
      
      tasks[taskIndex].assigneeId = assigneeId;
      const updatedTask = tasks[taskIndex];

      // Publish ke subscription
      pubsub.publish(TASK_UPDATED, { taskUpdated: updatedTask });
      
      return updatedTask;
    }
  },

  Subscription: {
    taskAdded: {
      // Filter agar subscription hanya dikirim ke tim yang relevan
      subscribe: (parent, { teamId }) => pubsub.asyncIterator(TASK_ADDED),
      resolve: (payload) => {
        // Ini hanya contoh, idealnya Anda filter berdasarkan teamId
        // if (payload.taskAdded.teamId === teamId) {
        //   return payload.taskAdded;
        // }
        return payload.taskAdded;
      },
    },
    taskUpdated: {
      subscribe: (parent, { teamId }) => pubsub.asyncIterator(TASK_UPDATED),
      resolve: (payload) => {
        // Filter juga di sini
        return payload.taskUpdated;
      },
    },
  },
};

async function startServer() {
  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      const user = req.headers['x-user'] ? JSON.parse(req.headers['x-user']) : null;
      return { user, pubsub };
    },
    plugins: [
      {
        requestDidStart() {
          return {
            willSendResponse(requestContext) {
              console.log(`GraphQL ${requestContext.request.operationName || 'Anonymous'} operation completed`);
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  
  const httpServer = app.listen(PORT, () => {
    console.log(`🚀 GraphQL API Server running on port ${PORT}`);
    console.log(`🔗 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📊 GraphQL Playground: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📡 Subscriptions ready`);
  });

  // Setup subscriptions
  server.installSubscriptionHandlers(httpServer);

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