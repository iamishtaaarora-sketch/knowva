// Provider registry: add a new provider by adding one entry. Every provider returns [{title,url,snippet}].
const UA = { 'User-Agent': 'KNOWVA/2.0 (learning project)' };
const e = encodeURIComponent, env = k => process.env[k] && process.env[k].trim();
const clean = s => (s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&amp;/g, '&').trim();
async function getJSON(url, opt = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000), ...opt, headers: { ...UA, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const providers = {
  web: {
    label: 'General Web', hint: 'Set TAVILY_API_KEY or BRAVE_API_KEY',
    available: () => !!(env('TAVILY_API_KEY') || env('BRAVE_API_KEY')),
    async search(q) {
      if (env('TAVILY_API_KEY')) {
        const d = await getJSON('https://api.tavily.com/search', { method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env('TAVILY_API_KEY') },
          body: JSON.stringify({ query: q, max_results: 5 }) });
        return d.results.map(r => ({ title: r.title, url: r.url, snippet: r.content }));
      }
      const d = await getJSON(`https://api.search.brave.com/res/v1/web/search?q=${e(q)}&count=5`, { headers: { 'X-Subscription-Token': env('BRAVE_API_KEY') } });
      return d.web.results.map(r => ({ title: clean(r.title), url: r.url, snippet: clean(r.description) }));
    },
  },
  wikipedia: {
    label: 'Wikipedia', available: () => true,
    async search(q) {
      const d = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${e(q)}&format=json&srlimit=4`);
      return d.query.search.map(r => ({ title: r.title, url: 'https://en.wikipedia.org/wiki/' + e(r.title.replace(/ /g, '_')), snippet: clean(r.snippet) }));
    },
  },
  github: {
    label: 'GitHub', available: () => true,
    async search(q) {
      const h = env('GITHUB_TOKEN') ? { Authorization: 'Bearer ' + env('GITHUB_TOKEN') } : {};
      const d = await getJSON(`https://api.github.com/search/repositories?q=${e(q)}&per_page=4`, { headers: h });
      return d.items.map(r => ({ title: r.full_name, url: r.html_url, snippet: `${r.description || 'No description'} (★ ${r.stargazers_count})` }));
    },
  },
  stackoverflow: {
    label: 'Stack Overflow', available: () => true,
    async search(q) {
      const d = await getJSON(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${e(q)}&site=stackoverflow&pagesize=4`);
      return d.items.map(i => ({ title: clean(i.title), url: i.link, snippet: `${i.answer_count} answers · score ${i.score}${i.is_answered ? ' · answered' : ''}` }));
    },
  },
  reddit: {
    label: 'Reddit', available: () => true, hint: 'Public JSON; Reddit may block some networks',
    async search(q) {
      const d = await getJSON(`https://www.reddit.com/search.json?q=${e(q)}&limit=4&raw_json=1`);
      return d.data.children.map(c => ({ title: c.data.title, url: 'https://www.reddit.com' + c.data.permalink, snippet: `r/${c.data.subreddit} · ${(c.data.selftext || '').slice(0, 250)}` }));
    },
  },
  youtube: {
    label: 'YouTube', hint: 'Set YOUTUBE_API_KEY', available: () => !!env('YOUTUBE_API_KEY'),
    async search(q) {
      const d = await getJSON(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=4&q=${e(q)}&key=${env('YOUTUBE_API_KEY')}`);
      return d.items.map(i => ({ title: clean(i.snippet.title), url: 'https://www.youtube.com/watch?v=' + i.id.videoId, snippet: `${i.snippet.channelTitle} · ${clean(i.snippet.description).slice(0, 200)}` }));
    },
  },
};

const list = () => Object.entries(providers).map(([id, p]) => ({ id, label: p.label, available: p.available(), hint: p.hint || '' }));

async function search(query, ids) {
  const use = ids.filter(id => providers[id]);
  const out = await Promise.allSettled(use.map(async id => {
    if (!providers[id].available()) throw new Error('Not configured. ' + providers[id].hint);
    return (await providers[id].search(query)).slice(0, 5).map(r => ({ ...r, snippet: (r.snippet || '').slice(0, 400), provider: id }));
  }));
  const results = [], status = {}, seen = new Set();
  out.forEach((o, i) => {
    status[use[i]] = o.status === 'fulfilled' ? 'ok' : o.reason.message;
    if (o.status === 'fulfilled') o.value.forEach(r => { if (r.url && !seen.has(r.url)) { seen.add(r.url); results.push(r); } });
  });
  return { results: results.slice(0, 12), status };
}
module.exports = { list, search };
