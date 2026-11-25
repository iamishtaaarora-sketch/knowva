const ACC = ['#7c5cff', '#3b82f6', '#22d3ee', '#ff5fa8', '#f59e0b', '#10b981'];
export const settings = (() => { try { return { theme: 'dark', accent: ACC[0], name: '', ...JSON.parse(localStorage['knowva.settings'] || '{}') }; } catch { return { theme: 'dark', accent: ACC[0], name: '' }; } })();
const $ = s => document.querySelector(s);
export function apply() {
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--a1', settings.accent);
  $('#uname').textContent = settings.name || 'Guest'; $('#avatar').textContent = (settings.name || 'K')[0].toUpperCase();
  $('#sAcc').innerHTML = ACC.map(c => `<button data-c="${c}" style="background:${c}" class="${c === settings.accent ? 'on' : ''}"></button>`).join('');
  localStorage['knowva.settings'] = JSON.stringify(settings);
}
export function init(onWipe) {
  $('#sName').value = settings.name; $('#sTheme').value = settings.theme;
  $('#openSet').onclick = () => $('#modal').hidden = false;
  $('#close').onclick = () => $('#modal').hidden = true;
  $('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
  $('#sName').oninput = e => { settings.name = e.target.value.trim(); apply(); };
  $('#sTheme').onchange = e => { settings.theme = e.target.value; apply(); };
  $('#sAcc').onclick = e => { if (e.target.dataset.c) { settings.accent = e.target.dataset.c; apply(); } };
  $('#wipe').onclick = () => { if (confirm('Delete ALL conversations?')) { onWipe(); $('#modal').hidden = true; } };
  apply();
}
