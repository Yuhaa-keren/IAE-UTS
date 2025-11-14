// services/rest-api/routes/auth.js
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Ganti users in-memory dengan database di produksi
let users = [];

// ==========================================
// TAMBAHAN PENTING: Inisialisasi Admin
// ==========================================
async function initAdmin() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt); // Password: admin123
    
    const adminUser = {
      id: 'admin-1',
      name: 'Super Admin',
      email: 'admin@test.com',
      password: hashedPassword,
      role: 'admin', // Role khusus
      createdAt: new Date().toISOString(),
    };

    users.push(adminUser);
    console.log('✅ Admin account initialized: admin@test.com / admin123');
  } catch (error) {
    console.error('❌ Gagal membuat admin:', error);
  }
}

// Jalankan fungsi ini agar admin dibuat saat server start
initAdmin();
// ==========================================


// Rute: POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Cek duplikat email
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword, 
      role: 'user', // Default role user biasa
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    res.status(201).json({ message: 'User created', userId: newUser.id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rute: POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Debug Log
    console.log('--- LOGIN ATTEMPT ---');
    console.log('Email:', email);
    
    const user = users.find(u => u.email === email);

    if (!user) {
      console.log('❌ User tidak ditemukan!');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Password salah!');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role // Penting untuk frontend membedakan admin/user
    };

    const privateKey = fs.readFileSync('private.key', 'utf8');

    const token = jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
      expiresIn: '1h'
    });

    console.log(`✅ Login Sukses: ${user.name} (${user.role})`);

    res.json({
      message: 'Login successful',
      token: token,
      user: { 
        id: user.id,      // <--- PENTING
        name: user.name, 
        role: user.role 
      }
    });

  } catch (err) {
    console.error('💥 Error Login:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;