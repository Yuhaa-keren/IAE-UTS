const express = require('express');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'REST API Service',
    timestamp: new Date().toISOString()
  });
});

app.get('/auth/public-key', (req, res) => {
  try {
    const publicKey = fs.readFileSync('public.key', 'utf8');
    res.status(200).send(publicKey);
  } catch (error) {
    res.status(500).json({ error: 'Public key file not found' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 REST API Service running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;