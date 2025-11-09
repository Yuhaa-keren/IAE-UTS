const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const jwt = require('jsonwebtoken'); // <-- Baru
const axios = require('axios'); // <-- Baru

const app = express();
const PORT = process.env.PORT || 3000;
let publicKey = null;
const USER_SERVICE_URL = process.env.REST_API_URL || 'http://localhost:3001';

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3002', // Frontend
    'http://localhost:3000', // Gateway itself
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// --- LOGIKA PUBLIC KEY ---
let publicKey = null;
const USER_SERVICE_URL = process.env.REST_API_URL || 'http://localhost:3001';

// Fungsi untuk mengambil public key dari User Service
async function fetchPublicKey() {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/auth/public-key`);
    publicKey = response.data;
    console.log('✅ Public key fetched successfully from User Service.');
  } catch (error) {
    console.error('❌ Failed to fetch public key. Retrying in 10 seconds...', error.message);
    // Coba lagi setelah 10 detik jika gagal
    setTimeout(fetchPublicKey, 10000);
  }
}

// --- MIDDLEWARE VERIFIKASI JWT ---
function verifyToken(req, res, next) {
  // 1. Cek jika public key sudah ada
  if (!publicKey) {
    return res.status(503).json({ error: 'Service unavailable. Missing public key.' });
  }

  // 2. Dapatkan token dari header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  // 3. Verifikasi token
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    
    // 4. Jika valid, tambahkan data user ke header untuk di-forward ke service lain
    req.user = decoded;
    // Kita akan meneruskan ini ke service downstream
    req.headers['x-user'] = JSON.stringify(decoded);
    
    next(); // Lanjutkan ke proxy
  } catch (ex) {
    res.status(400).json({ error: 'Invalid token.' });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      'rest-api': process.env.REST_API_URL || 'http://localhost:3001',
      'graphql-api': process.env.GRAPHQL_API_URL || 'http://localhost:4000'
    }
  });
});

// Proxy configuration for REST API
const restApiProxy = createProxyMiddleware({
  target: USER_SERVICE_URL, // Menggunakan variabel yang kita buat di atas
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', 
  },
  onProxyReq: (proxyReq, req, res) => {
    // Teruskan header user yang sudah diverifikasi
    if (req.user) {
      proxyReq.setHeader('x-user', JSON.stringify(req.user));
    }
    console.log(`[REST API] ${req.method} ${req.url} -> ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('REST API Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'REST API service unavailable',
      message: err.message 
    });
  }
});

// Proxy configuration for GraphQL API
const graphqlApiProxy = createProxyMiddleware({
  target: process.env.GRAPHQL_API_URL || 'http://localhost:4000',
  changeOrigin: true,
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    // Teruskan header user yang sudah diverifikasi
    if (req.user) {
      proxyReq.setHeader('x-user', JSON.stringify(req.user));
    }
    console.log(`[GraphQL API] ${req.method} ${req.url} -> ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('GraphQL API Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'GraphQL API service unavailable',
      message: err.message 
    });
  }
});

// Apply proxies
app.use('/api/auth', restApiProxy);
app.use('/api', verifyToken, restApiProxy); // Semua /api/* LAINNYA
app.use('/graphql', verifyToken, graphqlApiProxy); // Semua /graphql

// Catch-all route
app.get('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: [
      '/health',
      '/api/* (proxied to REST API)',
      '/graphql (proxied to GraphQL API)'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Proxying /api/* to: ${process.env.REST_API_URL || 'http://localhost:3001'}`);
  console.log(`🔄 Proxying /graphql to: ${process.env.GRAPHQL_API_URL || 'http://localhost:4000'}`);
  fetchPublicKey();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;