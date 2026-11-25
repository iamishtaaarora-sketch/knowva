import { md, esc, copy, toast } from './ui.js';
import { loadProviders, runSearch, NEEDS } from './search.js';
import * as settings from './settings.js';

const $ = s => document.querySelector(s);
const ld = (k, d) => { try { return JSON.parse(localStorage['knowva.' + k]) ?? d; } catch { return d; } };
const sv = (k, v) => localStorage['knowva.' + k] = JSON.stringify(v);
const S = { chats: ld('chats', []), cur: null, mode: 'chat', search: false, prov: new Set(ld('prov', ['web', 'wikipedia'])), provList: [], busy: false, ac: null, edit: null, file: null, filter: '' };

const split = c => {
  const m = c.match(/<suggestions>([\s\S]*?)(<\/suggestions>|$)/);
  return { text: c.replace(/<suggestions>[\s\S]*$/, '').replace(/<[a-z/]{0,12}$/, '').trim(),
    sug: m ? m[1].split('\n').map(s => s.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 3) : [] };
};
const save = () => sv('chats', S.chats.slice(0, 80));
const label = id => S.provList.find(p => p.id === id)?.label || id;

// ---------- rendering ----------
function srcHTML(m) {
  if (!m.src?.length && !m.fails?.length) return '';
  const cards = (m.src || []).map((s, i) => { let h = ''; try { h = new URL(s.url).hostname.replace('www.', ''); } catch {}
    return `<a href="${esc(s.url)}" target="_blank" rel="noopener"><i>[${i + 1}] ${esc(label(s.provider))}</i><b>${esc(s.title)}</b><small>${esc(h)}</small><small>${esc(s.snippet.slice(0, 110))}</small></a>`; }).join('');
  const fails = (m.fails || []).map(([id, msg]) => `${esc(label(id))}: ${esc(msg)}`).join(' · ');
  return `<details class="srcs" open><summary>🔎 <b>Retrieved sources</b> (${m.src?.length || 0}) — real results from the internet</summary><div class="sg">${cards}</div>${fails ? `<div class="warn">⚠ Unavailable: ${fails}</div>` : ''}</details>${m.src?.length ? '<div class="ans">✨ KNOWVA’s answer (AI-written, based on the sources above)</div>' : ''}`;
}
function body(m, last) {
  const { text, sug } = split(m.content);
  return srcHTML(m) +
    (m.phase && !text ? `<div class="ph"><span class="dots"><i></i><i></i><i></i></span> ${esc(m.phase)}</div>` : '') +
    `<div class="md">${md(text, m.src || [])}${m.busy && text ? '<span class="caret"></span>' : ''}</div>` +
    (m.stopped ? '<div class="warn">■ Generation stopped</div>' : '') + (m.err ? `<div class="err">${esc(m.err)}</div>` : '') +
    (!m.busy ? `<div class="acts"><button data-a="copy" title="Copy">⧉ Copy</button>${last ? '<button data-a="regen">↻ Regenerate</button>' : ''}</div>` : '') +
    (last && !S.busy && sug.length ? `<div class="sug">${sug.map(s => `<button>${esc(s)}</button>`).join('')}</div>` : '');
}
function msgHTML(m, i, last) {
  return m.role === 'user'
    ? `<div class="msg u" data-i="${i}"><div class="bub">${esc(m.content)}</div><div class="acts"><button data-a="edit" title="Edit & resend">✎</button><button data-a="copy" title="Copy">⧉</button></div></div>`
    : `<div class="msg b" data-i="${i}"><div class="av"><span class="orb mini"></span></div><div class="bd">${body(m, last)}</div></div>`;
}
const nearBottom = () => { const c = $('#chat'); return c.scrollHeight - c.scrollTop - c.clientHeight < 140; };
function paint() {
  const c = S.cur, i = c.msgs.length - 1, el = $('#msgs').lastElementChild?.querySelector('.bd'), stick = nearBottom();
  if (el) el.innerHTML = body(c.msgs[i], true);
  if (stick) $('#chat').scrollTop = $('#chat').scrollHeight;
}
function ui() {
  const ms = S.cur?.msgs || [];
  $('#welcome').style.display = ms.length ? 'none' : 'block';
  $('#msgs').innerHTML = ms.map((m, i) => msgHTML(m, i, i === ms.length - 1)).join('');
  $('#chat').scrollTop = $('#chat').scrollHeight;
  document.body.classList.toggle('thinking', S.busy);
  const b = $('#send'); b.textContent = S.busy ? '■' : '➤'; b.classList.toggle('stop', S.busy);
  $('#x').hidden = !$('#in').value;
  side();
}
function side() {
  const f = S.filter.toLowerCase(), v = S.chats.filter(c => !f || c.title.toLowerCase().includes(f) || c.msgs.some(m => m.content.toLowerCase().includes(f)));
  const row = c => `<div class="it ${c === S.cur ? 'act' : ''}" data-id="${c.id}"><span>${esc(c.title)}</span><button data-s="star" title="Save">${c.saved ? '★' : '☆'}</button><button data-s="ren" title="Rename">✎</button><button data-s="del" title="Delete">🗑</button></div>`;
  const sv_ = v.filter(c => c.saved), rc = v.filter(c => !c.saved);
  $('#list').innerHTML = (sv_.length ? '<h6>Saved</h6>' + sv_.map(row).join('') : '') + (rc.length ? '<h6>Recent</h6>' + rc.map(row).join('') : '') || '<h6>No conversations yet</h6>';
}
function provUI() {
  const on = S.search || S.mode === 'search';
  $('#prov').hidden = !on; $('#web').classList.toggle('on', on);
  $('#prov').innerHTML = S.provList.map(p => `<button class="chip ${S.prov.has(p.id) ? 'on' : ''} ${p.available ? '' : 'off'}" data-p="${p.id}" title="${esc(p.available ? p.label : p.hint)}">${p.available ? '' : '🔒 '}${esc(p.label)}</button>`).join('');
}
function setMode(m) {
  S.mode = m; document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('#in').placeholder = { chat: 'Ask KNOWVA anything…', search: 'Research a topic — KNOWVA will search and cite sources…', code: 'Describe the code you need or paste a bug…' }[m];
  provUI();
}

// ---------- chat flow ----------
function newChat() { S.cur = null; S.edit = null; $('#hint').hidden = true; ui(); $('#in').focus(); }
async function send(text) {
  text = text.trim(); if (S.busy || !text) return;
  if (S.file) { text += `\n\n[Attached file: ${S.file.name}]\n\`\`\`\n${S.file.text}\n\`\`\``; S.file = null; $('#hint').hidden = true; }
  if (!S.cur) { S.cur = { id: Date.now(), title: text.slice(0, 40), msgs: [] }; S.chats.unshift(S.cur); }
  if (S.edit != null) { S.cur.msgs.length = S.edit; S.edit = null; $('#hint').hidden = true; }
  S.cur.msgs.push({ role: 'user', content: text });
  $('#in').value = ''; $('#in').style.height = 'auto';
  await turn();
}
async function turn() {
  const c = S.cur, q = c.msgs[c.msgs.length - 1].content, bot = { role: 'assistant', content: '', src: [], fails: [], busy: true, phase: 'Thinking…' };
  c.msgs.push(bot); S.busy = true; S.ac = new AbortController(); ui();
  try {
    if (S.search || S.mode === 'search' || NEEDS.test(q)) {
      const ids = [...S.prov].length ? [...S.prov] : ['wikipedia'];
      bot.phase = 'Searching ' + ids.map(label).join(', ') + '…'; paint();
      try {
        const r = await runSearch(q.replace(/```[\s\S]*/, '').slice(0, 300), ids, S.ac.signal);
        bot.src = r.results; bot.fails = Object.entries(r.status).filter(([, v]) => v !== 'ok');
      } catch (e) { if (e.name === 'AbortError') throw e; bot.fails = [['search', e.message]]; }
    }
    bot.phase = 'Thinking…'; paint();
    const msgs = c.msgs.slice(0, -1).map(m => ({ role: m.role, content: m.role === 'assistant' ? split(m.content).text : m.content })).filter(m => m.content);
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: S.ac.signal, body: JSON.stringify({ messages: msgs, mode: S.mode, sources: bot.src }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Server error (${r.status})`);
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    while (true) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); const parts = buf.split('\n\n'); buf = parts.pop();
      for (const p of parts) {
        const d = p.replace(/^data: /, '').trim(); if (!d || d === '[DONE]') continue;
        try { bot.content += JSON.parse(d).choices?.[0]?.delta?.content || ''; } catch {}
      }
      bot.phase = ''; paint();
    }
  } catch (e) {
    if (e.name === 'AbortError') bot.stopped = true;
    else bot.err = e instanceof TypeError ? 'Can’t reach the KNOWVA server. Make sure it is running (npm start).' : e.message;
  }
  bot.busy = false; bot.phase = ''; S.busy = false; save(); ui();
}

// ---------- events ----------
$('#send').onclick = () => S.busy ? S.ac.abort() : send($('#in').value);
$('#in').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value); } };
$('#in').oninput = e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; $('#x').hidden = !e.target.value; };
$('#x').onclick = () => { $('#in').value = ''; $('#in').style.height = 'auto'; $('#x').hidden = true; S.edit = null; S.file = null; $('#hint').hidden = true; };
$('#new').onclick = () => { newChat(); $('#side').classList.remove('open'); };
$('#q').oninput = e => { S.filter = e.target.value; side(); };
$('#toggle').onclick = () => innerWidth <= 820 ? $('#side').classList.toggle('open') : $('#side').classList.toggle('hide');
$('#modes').onclick = e => e.target.dataset.m && setMode(e.target.dataset.m);
$('#web').onclick = () => { S.search = !S.search; provUI(); };
$('#prov').onclick = e => { const id = e.target.dataset.p; if (!id) return; const p = S.provList.find(x => x.id === id); if (!p.available) return toast(p.hint || 'Not configured'); S.prov.has(id) ? S.prov.delete(id) : S.prov.add(id); sv('prov', [...S.prov]); provUI(); };
$('#quick').onclick = e => { if (e.target.tagName !== 'BUTTON') return; const t = e.target.textContent; if (t === 'Code') setMode('code'); const i = $('#in'); i.value = (t === 'Code' ? 'Help me code: ' : t + ': ') + i.value; i.focus(); i.dispatchEvent(new Event('input')); };
document.querySelector('.cards').onclick = e => { if (e.target.closest('button')) { const t = e.target.closest('button').textContent.slice(2).trim(); if (/Research/.test(t)) setMode('search'); if (/code/.test(t)) setMode('code'); $('#in').value = t.replace(/\.$/, '') + ': '; $('#in').focus(); } };
$('#clear').onclick = () => { if (S.cur && confirm('Clear this conversation?')) { S.cur.msgs = []; S.cur.title = 'New chat'; save(); ui(); } };
$('#attach').onclick = () => $('#file').click();
$('#file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 100000) return toast('File too large (max 100 KB)');
  S.file = { name: f.name, text: await f.text() }; $('#hint').hidden = false; $('#hint').textContent = `📎 ${f.name} will be sent with your next message`; };

$('#list').onclick = e => {
  const row = e.target.closest('.it'); if (!row) return; const c = S.chats.find(x => x.id == row.dataset.id), a = e.target.dataset.s;
  if (a === 'star') c.saved = !c.saved;
  else if (a === 'ren') { const t = prompt('Rename conversation', c.title); if (t?.trim()) c.title = t.trim().slice(0, 60); }
  else if (a === 'del') { if (!confirm('Delete this conversation?')) return; S.chats = S.chats.filter(x => x !== c); if (S.cur === c) S.cur = null; }
  else { if (S.busy) return; S.cur = c; $('#side').classList.remove('open'); }
  save(); ui();
};
$('#msgs').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const ms = S.cur.msgs, i = +e.target.closest('.msg')?.dataset.i;
  if (b.dataset.copycode !== undefined) return copy(b.closest('.code').querySelector('code').textContent);
  if (b.closest('.sug')) return send(b.textContent);
  if (b.dataset.a === 'copy') copy(split(ms[i].content).text);
  if (b.dataset.a === 'regen' && !S.busy) { ms.pop(); turn(); }
  if (b.dataset.a === 'edit' && !S.busy) { S.edit = i; $('#in').value = ms[i].content; $('#in').focus(); $('#in').dispatchEvent(new Event('input')); $('#hint').hidden = false; $('#hint').textContent = '✎ Editing message — press Enter to resend (✕ to cancel)'; }
};
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'k') { e.preventDefault(); newChat(); }
  else if (mod && e.key === 'b') { e.preventDefault(); $('#toggle').click(); }
  else if (e.key === 'Escape') { if (S.busy) S.ac.abort(); $('#modal').hidden = true; }
  else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#in').focus(); }
});

settings.init(() => { S.chats = []; S.cur = null; save(); ui(); });
loadProviders().then(p => { S.provList = p; S.prov = new Set([...S.prov].filter(id => p.find(x => x.id === id && x.available))); if (!S.prov.size) S.prov.add('wikipedia'); provUI(); });
setMode('chat'); ui();
