{
const USER = 'DennisHoglund';
const API = 'https://api.github.com';
const VERSION = '0.1';
const GAMES = ['pixelrace'];

const out = document.getElementById('out');
const inp = document.getElementById('in');
const term = document.getElementById('term');
const keys = document.getElementById('keys');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const line = (html = '') => { const d = document.createElement('div'); d.innerHTML = html; out.appendChild(d); term.scrollTop = term.scrollHeight; return d; };
const span = (cls, txt) => `<span class="${cls}">${esc(txt)}</span>`;
const PS = '<span class="ps">dennis@pixel:~$</span> ';

const ago = iso => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min';
  if (s < 86400) return Math.round(s / 3600) + ' tim';
  const d = Math.round(s / 86400);
  if (d < 14) return d + (d === 1 ? ' dag' : ' dagar');
  if (d < 60) return Math.round(d / 7) + ' veckor';
  return Math.round(d / 30) + ' mån';
};
const pad = (s, n) => (s + '').padEnd(n, ' ');

/* --- cache: localStorage, wrapped since it can throw --- */
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('pixelos.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('pixelos.' + k, JSON.stringify(v)); } catch {} }
};

async function gh(path, cacheKey, maxAgeMs = 5 * 60 * 1000) {
  const c = store.get(cacheKey);
  if (c && Date.now() - c.t < maxAgeMs) return c.data;
  try {
    const r = await fetch(API + path, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.status === 403 || r.status === 429) throw new Error('rate');
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    store.set(cacheKey, { t: Date.now(), data });
    return data;
  } catch (e) {
    if (c) { line(span('dim', '(offline – visar sparad data från ' + ago(new Date(c.t).toISOString()) + ' sedan)')); return c.data; }
    if (e.message === 'rate') throw new Error('GitHub säger stopp en stund (max 60 anrop/tim). Försök igen snart.');
    throw new Error('kunde inte nå GitHub');
  }
}

let repos = store.get('repos')?.data || [];
async function loadRepos() {
  const data = await gh(`/users/${USER}/repos?per_page=100&sort=pushed`, 'repos');
  repos = data.filter(r => !r.fork).sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
  renderKeys();
  return repos;
}
const find = name => repos.find(r => r.name.toLowerCase() === String(name).replace(/\/$/, '').toLowerCase());
const color = r => GAMES.includes(r.name.toLowerCase()) ? 'warn' : '';
const isWip = r => (Date.now() - new Date(r.pushed_at)) / 86400000 < 7;
const pagesUrl = r => r.homepage || (r.has_pages ? `https://${USER.toLowerCase()}.github.io/${r.name}/` : null);

/* --- commands --- */
const cmds = {
  async ls(args) {
    const list = await loadRepos();
    if (args.includes('-l')) {
      line(span('dim', `totalt ${list.length} projekt`));
      list.forEach(r => line(
        (isWip(r) ? span('warn', '[wip]') : '[ok] ') + '  ' +
        span('dim', pad(ago(r.pushed_at), 9)) + ' ' +
        `<b style="font-weight:500" class="${color(r)}">${esc(r.name)}</b>`
      ));
    } else {
      line(list.map(r => `<span class="${color(r)}">${esc(r.name)}/</span>`).join('   '));
    }
  },
  async cat([name]) {
    if (!name) return line('användning: cat &lt;projekt&gt;');
    await loadRepos();
    const r = find(name);
    if (!r) return line(span('err', `cat: ${name}: Ingen sådan fil eller katalog`));
    line(span('hi', '# ' + r.name));
    if (r.description) line(esc(r.description));
    line(span('dim', 'språk:   ') + esc(r.language || '–'));
    line(span('dim', 'skapad:  ') + esc(new Date(r.created_at).toLocaleDateString('sv-SE')));
    line(span('dim', 'pushad:  ') + esc(ago(r.pushed_at) + ' sedan'));
    const p = pagesUrl(r);
    if (p) line(span('dim', 'app:     ') + `<a href="${esc(p)}" target="_blank" rel="noopener">${esc(p)}</a>`);
    try {
      const c = await gh(`/repos/${USER}/${r.name}/commits?per_page=1`, 'c1.' + r.name);
      if (c[0]) line(span('dim', 'senast:  ') + esc(c[0].commit.message.split('\n')[0]));
    } catch {}
  },
  async log([name, n]) {
    if (!name) return line('användning: log &lt;projekt&gt; [antal]');
    await loadRepos();
    const r = find(name);
    if (!r) return line(span('err', `log: ${name}: finns inte`));
    const count = Math.min(20, Math.max(1, parseInt(n) || 8));
    const c = await gh(`/repos/${USER}/${r.name}/commits?per_page=${count}`, `c${count}.${r.name}`);
    c.forEach(x => line(span('warn', x.sha.slice(0, 7)) + ' ' + span('dim', pad(ago(x.commit.author.date), 9)) + ' ' + esc(x.commit.message.split('\n')[0])));
  },
  async open([name]) {
    if (!name) return line('användning: open &lt;projekt&gt;');
    await loadRepos();
    const r = find(name);
    if (!r) return line(span('err', `open: ${name}: finns inte`));
    const url = pagesUrl(r) || r.html_url;
    line('öppnar ' + `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`);
    window.open(url, '_blank');
  },
  async git([sub, name]) {
    if (sub !== 'clone' || !name) return line('stöds: git clone &lt;projekt&gt;  (visar klon-kommandot)');
    await loadRepos();
    const r = find(name);
    line(r ? esc('git clone ' + r.clone_url) : span('err', 'finns inte'));
  },
  whoami() { line(USER.toLowerCase()); },
  date() { line(esc(new Date().toLocaleString('sv-SE'))); },
  async neofetch() {
    await loadRepos();
    const langs = {};
    repos.forEach(r => { if (r.language) langs[r.language] = (langs[r.language] || 0) + 1; });
    const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(', ');
    const art = ['  ▄▄▄▄▄▄▄ ', ' █ ▄▄▄ █ ', ' █ ███ █ ', ' █▄▄▄▄▄█ ', '  ▀▀▀▀▀  '];
    const info = [span('hi', 'dennis@pixel'), span('dim', 'os:      ') + 'Pixel-OS ' + VERSION, span('dim', 'projekt: ') + repos.length, span('dim', 'språk:   ') + esc(top || '–'), span('dim', 'senast:  ') + esc(repos[0]?.name || '–')];
    art.forEach((a, i) => line(esc(a) + '  ' + (info[i] || '')));
  },
  help() {
    [['ls', 'lista projekt'], ['ls -l', 'med status och senaste push'], ['cat <projekt>', 'detaljer + senaste commit'], ['log <projekt> [n]', 'senaste commits'], ['open <projekt>', 'öppna appen'], ['git clone <projekt>', 'visa klon-kommando'], ['neofetch', 'systeminfo'], ['whoami, date, clear', ''], ['', ''], ['tab', 'komplettera namn · ↑↓ historik']]
      .forEach(([c, d]) => line(c ? span('hi', pad(c, 20)) + span('dim', d) : ''));
  },
  clear() { out.innerHTML = ''; }
};

/* --- input, history, completion --- */
let hist = store.get('hist') || [], hi = hist.length;
async function run(raw) {
  line(PS + esc(raw));
  const c = raw.trim();
  if (!c) return;
  hist = [...hist.filter(h => h !== c), c].slice(-50); hi = hist.length; store.set('hist', hist);
  const [name, ...args] = c.split(/\s+/);
  const fn = cmds[name.toLowerCase()];
  if (!fn) return line(span('err', `${name}: kommandot hittades inte`) + span('dim', ' · skriv help'));
  inp.disabled = true;
  const wait = line(span('dim', '…'));
  try { await fn(args); } catch (e) { line(span('err', e.message)); }
  wait.remove();
  inp.disabled = false; inp.focus({ preventScroll: true });
  term.scrollTop = term.scrollHeight;
}

function complete() {
  const parts = inp.value.split(' ');
  const last = parts.at(-1).toLowerCase();
  const pool = parts.length === 1 ? Object.keys(cmds) : repos.map(r => r.name);
  const hits = pool.filter(p => p.toLowerCase().startsWith(last));
  if (hits.length === 1) { parts[parts.length - 1] = hits[0]; inp.value = parts.join(' ') + ' '; }
  else if (hits.length > 1) line(span('dim', hits.join('  ')));
}

inp.addEventListener('keydown', e => {
  if (e.key === 'Enter') { const v = inp.value; inp.value = ''; run(v); }
  else if (e.key === 'Tab') { e.preventDefault(); complete(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
  else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
});
term.addEventListener('click', () => { if (!getSelection().toString()) inp.focus(); });

/* --- quick keys for the phone: commands, then the 6 latest projects --- */
function renderKeys() {
  const base = ['ls', 'ls -l', 'neofetch', 'help', 'clear', 'tab ⇥'];
  const recent = repos.slice(0, 6).map(r => 'cat ' + r.name);
  keys.innerHTML = [...base, ...recent].map(k => `<button type="button" data-k="${esc(k)}">${esc(k)}</button>`).join('');
}
keys.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.k;
  if (k === 'tab ⇥') { complete(); inp.focus(); return; }
  run(k);
});

/* --- boot --- */
renderKeys();
line(span('dim', `PIXEL-OS ${VERSION} · inloggad som ${USER.toLowerCase()} · ${new Date().toLocaleDateString('sv-SE')}`));
line(span('dim', 'skriv help för kommandon'));
line('');
run('ls');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
