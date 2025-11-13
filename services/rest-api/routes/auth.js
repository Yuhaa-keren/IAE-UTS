// services/rest-api/routes/auth.js
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Ganti users in-memory dengan database di produksi
let users = []; 

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
      password: hashedPassword, // Simpan hash, bukan password asli
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
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Bandingkan password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Buat JWT Token
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name
    };
    
    const privateKey = fs.readFileSync('private.key', 'utf8');
    
    // Gunakan algoritma RS256 karena kita pakai RSA
    const token = jwt.sign(payload, privateKey, { 
      algorithm: 'RS256',
      expiresIn: '1h' 
    });

    res.json({
      message: 'Login successful',
      token: token
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;