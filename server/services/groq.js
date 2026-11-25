const URL = 'https://api.groq.com/openai/v1/chat/completions';
const keyOk = () => process.env.GROQ_API_KEY && !/paste_your/.test(process.env.GROQ_API_KEY);

function systemPrompt({ mode, sources }) {
  let s = `You are KNOWVA, a friendly, intelligent, creative AI assistant (tagline: "Think Beyond. Discover More."). Today is ${new Date().toDateString()}. Answer in clean Markdown with headings, lists, tables and code blocks where useful.`;
  if (mode === 'code') s += ' CODE MODE: act as a senior engineer. Give complete, working, well-commented code in fenced blocks with the language tag, then a brief explanation.';
  if (sources.length) {
    s += ' Below are REAL retrieved search results. Base any current or factual claims on them and cite inline as [1], [2]. Keep retrieved facts clearly separate from your own reasoning, and say so if the sources do not answer the question.\n\n' +
      sources.map((r, i) => `[${i + 1}] (${r.provider}) ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n');
  }
  return s + '\n\nAt the very end of every answer add exactly this block with 3 short follow-up questions the user might ask:\n<suggestions>\nquestion 1\nquestion 2\nquestion 3\n</suggestions>';
}

const friendly = status =>
  status === 401 ? 'Groq rejected the API key. Check GROQ_API_KEY in your .env file.' :
  status === 404 || status === 400 ? 'Groq could not use this model or request. Check GROQ_MODEL in .env (see console.groq.com/docs/models).' :
  status === 429 ? 'Groq rate limit reached. Please wait a moment and try again.' :
  'Groq is temporarily unavailable. Please try again shortly.';

function stream({ messages, mode, sources, signal }) {
  return fetch(URL, {
    method: 'POST', signal,
    headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', stream: true, temperature: 0.7,
      messages: [{ role: 'system', content: systemPrompt({ mode, sources }) }, ...messages] }),
  });
}
module.exports = { stream, friendly, keyOk };
