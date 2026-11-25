# KNOWVA — Think Beyond. Discover More.
Premium AI chat app: HTML/CSS/vanilla JS frontend, Node.js + Express backend, Groq AI, multi-source search with citations.

## Setup
1. **Install Node.js 18+** from https://nodejs.org (check: `node -v`).
2. **Install dependencies:** open a terminal in this folder and run `npm install`
3. **Get a Groq key:** sign in at https://console.groq.com/keys → *Create API Key*.
4. **Paste it** into the `.env` file: `GROQ_API_KEY=gsk_...` (copy `.env.example` to `.env` if missing).
5. **Start:** `npm start`  (auto-reload while editing: `npm run dev`)
6. **Open** http://localhost:3000

## Model
Set `GROQ_MODEL` in `.env`. Recommended: `llama-3.3-70b-versatile` (production, 131K context). Faster/cheaper: `llama-3.1-8b-instant`. Always check https://console.groq.com/docs/models — model names change over time.

## Search (Groq alone has no web search)
| Source | Needs |
|---|---|
| Wikipedia, Stack Overflow, GitHub | nothing (GitHub: optional `GITHUB_TOKEN`) |
| Reddit | nothing (public JSON; Reddit sometimes blocks servers/VPNs) |
| General Web | `TAVILY_API_KEY` (https://tavily.com) **or** `BRAVE_API_KEY` (https://brave.com/search/api) |
| YouTube | `YOUTUBE_API_KEY` (Google Cloud → enable *YouTube Data API v3*) |

Locked 🔒 chips in the UI mean a key is missing. Add a provider in `server/services/searchProviders.js` (one object). Restart after editing `.env`.

## Using it
Modes: **Chat / Search / Code**. Toggle 🌐 Search to pick sources; time-sensitive questions ("latest…", "today…") auto-search. Hover messages to copy, edit & resend, or regenerate. Shortcuts: `Ctrl+K` new chat · `/` focus · `Ctrl+B` sidebar · `Esc` stop.

## Troubleshooting
- **"Groq API key missing / rejected"** → check `.env`, no quotes/spaces, restart.
- **"Cannot find module express"** → run `npm install`.
- **Port in use** → change `PORT` in `.env`.
- **Model error** → update `GROQ_MODEL` from the Groq models page.
- **A source says "Unavailable"** → missing key or provider rate limit; others still work.
- Chats live in your browser's localStorage (per browser/device).
