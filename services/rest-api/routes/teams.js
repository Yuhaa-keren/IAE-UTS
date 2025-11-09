// services/rest-api/routes/teams.js
const express = require('express');
const router = express.Router();

// Ganti dengan database
let teams = [{ id: 'team1', name: 'Alpha Team', members: ['1'] }]; 

// GET /api/teams - Dapat semua tim
router.get('/', (req, res) => {
  res.json(teams);
});

// POST /api/teams - Buat tim baru
router.post('/', (req, res) => {
  // ... (logika membuat tim)
  res.status(201).json({ message: 'Team created' });
});

// GET /api/teams/:id - Dapat detail tim
router.get('/:id', (req, res) => {
  const team = teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  res.json(team);
});

module.exports = router;