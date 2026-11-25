require('dotenv').config();
const express = require('express'), cors = require('cors'), path = require('path');
const app = express(), PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false }));
app.use(express.json({ limit: '1mb' }));

// Basic in-memory rate limit: 40 API requests / minute / IP
const hits = new Map();
app.use('/api', (req, res, next) => {
  const now = Date.now(), h = hits.get(req.ip) || { n: 0, t: now + 60000 };
  if (now > h.t) { h.n = 0; h.t = now + 60000; }
  hits.set(req.ip, h);
  if (++h.n > 40) return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  next();
});

app.use('/api/chat', require('./server/routes/chat'));
app.use('/api/search', require('./server/routes/search'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => res.status(400).json({ error: 'Invalid request.' }));

app.listen(PORT, () => {
  const ok = process.env.GROQ_API_KEY && !/paste_your/.test(process.env.GROQ_API_KEY);
  console.log(`\n✨ KNOWVA running → http://localhost:${PORT}`);
  if (!ok) console.log('⚠️  Add your GROQ_API_KEY to .env, then restart.');
});
