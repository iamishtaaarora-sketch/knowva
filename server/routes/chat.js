const router = require('express').Router();
const groq = require('../services/groq');

router.post('/', async (req, res) => {
  const { messages, mode = 'chat', sources = [] } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > 60)
    return res.status(400).json({ error: 'Send between 1 and 60 messages.' });
  const clean = messages.map(m => ({ role: m && m.role, content: typeof (m && m.content) === 'string' ? m.content.trim() : '' }));
  if (clean.some(m => !['user', 'assistant'].includes(m.role) || !m.content || m.content.length > 30000) || clean[clean.length - 1].role !== 'user')
    return res.status(400).json({ error: 'Messages must be non-empty and end with a user message.' });
  if (!groq.keyOk()) return res.status(500).json({ error: 'Groq API key missing. Paste it into the .env file and restart the server.' });

  const src = (Array.isArray(sources) ? sources : []).slice(0, 12).filter(s => s && /^https?:\/\//.test(s.url))
    .map(s => ({ title: String(s.title || '').slice(0, 200), url: s.url, snippet: String(s.snippet || '').slice(0, 500), provider: String(s.provider || 'web') }));

  const ac = new AbortController();
  res.on('close', () => ac.abort()); // user pressed Stop / closed tab
  try {
    const up = await groq.stream({ messages: clean, mode: mode === 'code' ? 'code' : 'chat', sources: src, signal: ac.signal });
    if (!up.ok) { console.log('Groq error', up.status, (await up.text()).slice(0, 300)); return res.status(502).json({ error: groq.friendly(up.status) }); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    for await (const c of up.body) res.write(c);
    res.end();
  } catch (e) {
    if (e.name === 'AbortError') return res.end();
    console.log('Chat error:', e.message);
    if (!res.headersSent) res.status(502).json({ error: 'KNOWVA could not reach Groq. Check your internet connection and try again.' });
    else res.end();
  }
});
module.exports = router;
