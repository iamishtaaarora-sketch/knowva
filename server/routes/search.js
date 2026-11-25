const router = require('express').Router();
const sp = require('../services/searchProviders');

router.get('/providers', (req, res) => res.json({ providers: sp.list() }));

router.post('/', async (req, res) => {
  const { query, providers } = req.body || {};
  if (typeof query !== 'string' || !query.trim() || query.length > 400) return res.status(400).json({ error: 'Provide a search query (max 400 characters).' });
  if (!Array.isArray(providers) || !providers.length) return res.status(400).json({ error: 'Choose at least one search source.' });
  try { res.json(await sp.search(query.trim(), providers.slice(0, 6))); }
  catch (e) { res.status(502).json({ error: 'Search is temporarily unavailable.' }); }
});
module.exports = router;
