export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function toast(t) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }
export const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Copied ✓'); } catch { toast('Copy failed'); } };

function codeBlock(lang, raw) {
  const code = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\n$/, '');
  let html = esc(code);
  try { if (window.hljs && hljs.getLanguage(lang)) html = hljs.highlight(code, { language: lang }).value; } catch {}
  return `<div class="code"><div class="ch"><span>${esc(lang || 'code')}</span><button data-copycode>Copy</button></div><pre><code class="hljs">${html}</code></pre></div>`;
}

// Small Markdown renderer: headings, lists, tables, quotes, code, bold/italic, links, [n] citations
export function md(src, sources = []) {
  const blocks = [];
  const t = esc(src).replace(/```(\w*)\n([\s\S]*?)(```|$)/g, (_, l, c) => { blocks.push(codeBlock(l, c)); return `\u0000${blocks.length - 1}\u0000`; });
  const inl = s => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[(\d{1,2})\]/g, (m, n) => sources[n - 1] ? `<a class="cite" href="${esc(sources[n - 1].url)}" target="_blank" rel="noopener" title="${esc(sources[n - 1].title)}">${n}</a>` : m);
  const L = t.split('\n'), out = []; let i = 0;
  const LI = /^\s*([-*]|\d+\.)\s+/;
  while (i < L.length) {
    const l = L[i]; let m;
    if (/^\u0000\d+\u0000$/.test(l.trim())) { out.push(l.trim()); i++; continue; }
    if (/^\|.*\|\s*$/.test(l) && /^\|?[\s:|-]+\|?$/.test(L[i + 1] || '') && (L[i + 1] || '').includes('-')) {
      const row = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inl(c.trim()));
      const h = row(l); i += 2; const b = [];
      while (i < L.length && /^\|/.test(L[i])) b.push(row(L[i++]));
      out.push(`<div class="tw"><table><tr>${h.map(c => `<th>${c}</th>`).join('')}</tr>${b.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`); continue;
    }
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { const n = m[1].length + 1; out.push(`<h${n}>${inl(m[2])}</h${n}>`); i++; continue; }
    if (LI.test(l)) {
      const ol = /^\s*\d+\./.test(l), items = [];
      while (i < L.length && LI.test(L[i])) items.push(`<li>${inl(L[i++].replace(LI, ''))}</li>`);
      out.push(`<${ol ? 'ol' : 'ul'}>${items.join('')}</${ol ? 'ol' : 'ul'}>`); continue;
    }
    if (/^&gt;\s?/.test(l)) { out.push(`<blockquote>${inl(l.replace(/^&gt;\s?/, ''))}</blockquote>`); i++; continue; }
    if (/^---+$/.test(l.trim())) { out.push('<hr>'); i++; continue; }
    if (l.trim()) out.push(`<p>${inl(l)}</p>`); i++;
  }
  return out.join('').replace(/\u0000(\d+)\u0000/g, (_, k) => blocks[k]);
}
