/* Header ☰ menu → login → private motion-video vault (Netlify Blobs via /api/vault) */
(() => {
  const API = '/api/vault/';
  const TK = 'sk_session';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = b => b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
  const fmtDate = t => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let token = localStorage.getItem(TK) || '';
  let items = [], chunkSize = 3 * 1024 * 1024;
  const cache = new Map(); // id -> object URL of the assembled video

  async function api(path, opts = {}) {
    const res = await fetch(API + path, { ...opts, headers: { ...(opts.headers || {}), ...(token ? { authorization: 'Bearer ' + token } : {}) } });
    if (res.status === 401 && path !== 'login') { logout(true); throw new Error('Sesi berakhir'); }
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Gagal (' + res.status + ')'); }
    return res;
  }
  const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || /Sesi/.test(e.message)) throw e; await new Promise(r => setTimeout(r, 800 * (i + 1))); } } };

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'vt-toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }

  /* ---------- menu ---------- */
  const btn = $('#menu-btn'); if (!btn) return;
  const pop = document.createElement('div'); pop.className = 'mn-pop'; pop.hidden = true; pop.setAttribute('role', 'menu');
  document.body.appendChild(pop);
  function renderMenu() {
    pop.innerHTML = token
      ? '<button type="button" role="menuitem" data-a="open"><span class="mn-ic">🎞️</span>Koleksi saya</button><button type="button" role="menuitem" data-a="out"><span class="mn-ic">↩︎</span>Keluar</button>'
      : '<button type="button" role="menuitem" data-a="login"><span class="mn-ic">👤</span>Masuk</button>';
  }
  function placeMenu() { const r = btn.getBoundingClientRect(); pop.style.top = (r.bottom + 8) + 'px'; pop.style.right = Math.max(10, innerWidth - r.right) + 'px'; }
  function toggleMenu(open) {
    open = open ?? pop.hidden;
    if (open) { renderMenu(); placeMenu(); }
    pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    if (open) pop.querySelector('button')?.focus();
  }
  btn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target)) toggleMenu(false); });
  addEventListener('resize', () => { if (!pop.hidden) placeMenu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!pop.hidden) toggleMenu(false); else if (!lg.hidden) closeLogin(); else if (!player.hidden) closePlayer(); } });
  pop.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    toggleMenu(false);
    if (a === 'login') openLogin(); else if (a === 'open') openVault(); else if (a === 'out') logout();
  });

  /* ---------- login (generic on purpose) ---------- */
  const lg = document.createElement('div'); lg.className = 'lg-back'; lg.hidden = true;
  lg.innerHTML = `<form class="lg-card" role="dialog" aria-modal="true" aria-labelledby="lg-t" novalidate>
    <button type="button" class="lg-x" aria-label="Tutup">×</button>
    <h2 id="lg-t">Masuk</h2><p>Masuk ke akunmu untuk melanjutkan.</p>
    <label for="lg-u">Username</label><input id="lg-u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
    <label for="lg-p">Password</label><input id="lg-p" name="password" type="password" autocomplete="current-password" required>
    <div class="lg-err" aria-live="polite"></div>
    <button class="lg-go" type="submit">Masuk</button></form>`;
  document.body.appendChild(lg);
  const lgForm = $('form', lg), lgErr = $('.lg-err', lg), lgGo = $('.lg-go', lg);
  function openLogin() { lgErr.textContent = ''; lgForm.reset(); lg.hidden = false; setTimeout(() => $('#lg-u').focus(), 30); }
  function closeLogin() { lg.hidden = true; btn.focus(); }
  $('.lg-x', lg).addEventListener('click', closeLogin);
  lg.addEventListener('click', e => { if (e.target === lg) closeLogin(); });
  lgForm.addEventListener('submit', async e => {
    e.preventDefault();
    const u = $('#lg-u').value.trim(), p = $('#lg-p').value;
    if (!u || !p) { lgErr.textContent = 'Isi username dan password dulu ya.'; return; }
    lgGo.disabled = true; lgErr.textContent = '';
    try {
      const res = await api('login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ u, p }) });
      token = (await res.json()).token; localStorage.setItem(TK, token);
      lg.hidden = true; openVault();
    } catch (err) {
      lgErr.textContent = err.message || 'Gagal masuk';
      lgForm.classList.remove('shake'); void lgForm.offsetWidth; lgForm.classList.add('shake');
    } finally { lgGo.disabled = false; }
  });

  function logout(expired) {
    token = ''; localStorage.removeItem(TK);
    cache.forEach(u => URL.revokeObjectURL(u)); cache.clear(); items = [];
    closeVault(); if (expired) toast('Sesi berakhir, silakan masuk lagi');
  }

  /* ---------- vault ---------- */
  const canRec = !!(navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder && HTMLMediaElement.prototype.captureStream);
  const vt = document.createElement('div'); vt.className = 'vt'; vt.hidden = true;
  vt.setAttribute('role', 'dialog'); vt.setAttribute('aria-modal', 'true'); vt.setAttribute('aria-label', 'Koleksi video');
  vt.innerHTML = `<div class="vt-in">
    <div class="vt-top">
      <div class="vt-brand"><div class="vt-logo">▶</div><div><h2>Motion Vault</h2><small>Simpanan video motion pribadi</small></div></div>
      <button type="button" class="vt-btn pri" data-v="up">⬆<span class="lb"> Unggah video</span></button>
      <button type="button" class="vt-btn rec" data-v="rec" ${canRec ? '' : 'disabled title="Rekam hanya tersedia di Chrome/Edge desktop"'}><span class="lb">Rekam motion Beranda</span></button>
      <button type="button" class="vt-btn icon" data-v="out" title="Keluar" aria-label="Keluar">↩︎</button>
      <button type="button" class="vt-btn icon" data-v="close" title="Tutup" aria-label="Tutup">✕</button>
    </div>
    <div class="vt-drop" data-v="up" role="button" tabindex="0">Tarik &amp; lepas file video ke sini, atau <b>pilih dari perangkat</b><br><small>MP4, WebM, MOV — ukuran berapa pun, otomatis dipecah saat diunggah</small></div>
    ${canRec ? '' : '<p class="vt-note">Rekam motion Beranda butuh Chrome atau Edge di laptop/PC. Di HP, unggah file videonya saja.</p>'}
    <input type="file" accept="video/*" multiple hidden>
    <div class="vt-jobs"></div>
    <div class="vt-head"><h3>Koleksi</h3><span class="vt-sum"></span></div>
    <div class="vt-grid"></div>
  </div>`;
  document.body.appendChild(vt);
  const fileIn = $('input[type=file]', vt), grid = $('.vt-grid', vt), jobs = $('.vt-jobs', vt), sum = $('.vt-sum', vt), drop = $('.vt-drop', vt);

  const player = document.createElement('div'); player.className = 'vt-player'; player.hidden = true;
  player.innerHTML = '<video controls playsinline></video><div class="bar"><button type="button" class="vt-btn pri" data-p="dl">⬇ Unduh</button><button type="button" class="vt-btn" data-p="x">Tutup</button></div>';
  document.body.appendChild(player);
  const pv = $('video', player); let playing = null;
  function closePlayer() { pv.pause(); pv.removeAttribute('src'); pv.load(); player.hidden = true; playing = null; }
  player.addEventListener('click', e => {
    const a = e.target.closest('[data-p]')?.dataset.p;
    if (a === 'x' || e.target === player) closePlayer(); else if (a === 'dl' && playing) download(playing);
  });

  async function openVault() {
    if (!token) return openLogin();
    vt.hidden = false; document.body.classList.add('vt-open');
    await refresh();
  }
  function closeVault() { vt.hidden = true; document.body.classList.remove('vt-open'); closePlayer(); }

  async function refresh() {
    if (!items.length) grid.innerHTML = '<div class="vt-empty"><b>Memuat…</b></div>';
    try {
      const j = await (await api('list')).json();
      items = j.items; chunkSize = j.chunk || chunkSize; renderGrid();
    } catch (e) { if (token) grid.innerHTML = `<div class="vt-empty"><b>Gagal memuat</b>${esc(e.message)}</div>`; }
  }
  function renderGrid() {
    const total = items.reduce((a, b) => a + b.size, 0);
    sum.textContent = items.length ? `${items.length} video · ${fmtSize(total)}` : '';
    if (!items.length) { grid.innerHTML = '<div class="vt-empty"><b>Belum ada video</b>Unggah video motion pertamamu, atau rekam motion Beranda langsung dari sini.</div>'; return; }
    grid.innerHTML = items.map(it => `<article class="vt-card" data-id="${it.id}">
      <button type="button" class="vt-thumb" data-c="play" aria-label="Putar ${esc(it.name)}">${cache.has(it.id) ? `<video src="${cache.get(it.id)}#t=0.5" muted playsinline preload="metadata"></video>` : ''}<span class="vt-play">▶</span></button>
      <div class="vt-meta"><div class="nm">${esc(it.name)}</div><div class="sub">${fmtSize(it.size)} · ${fmtDate(it.created)}</div></div>
      <div class="vt-act"><button type="button" class="vt-btn pri" data-c="dl">⬇ Unduh</button><button type="button" class="vt-btn" data-c="ren" title="Ganti nama" aria-label="Ganti nama">✎</button><button type="button" class="vt-btn" data-c="del" title="Hapus" aria-label="Hapus">🗑</button></div>
    </article>`).join('');
  }

  vt.addEventListener('click', async e => {
    const v = e.target.closest('[data-v]')?.dataset.v;
    if (v === 'up') fileIn.click();
    else if (v === 'close') closeVault();
    else if (v === 'out') logout();
    else if (v === 'rec') record();
    const c = e.target.closest('[data-c]'); if (!c) return;
    const it = items.find(x => x.id === c.closest('[data-id]').dataset.id); if (!it) return;
    if (c.dataset.c === 'dl') download(it);
    else if (c.dataset.c === 'play') play(it);
    else if (c.dataset.c === 'ren') {
      const name = prompt('Nama baru:', it.name); if (!name || name === it.name) return;
      try { const j = await (await api('rename?id=' + it.id, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })).json(); it.name = j.item.name; renderGrid(); } catch (err) { toast(err.message); }
    } else if (c.dataset.c === 'del') {
      if (!confirm(`Hapus "${it.name}"? Ini tidak bisa dibatalkan.`)) return;
      try { await api('item?id=' + it.id, { method: 'DELETE' }); items = items.filter(x => x !== it); if (cache.has(it.id)) { URL.revokeObjectURL(cache.get(it.id)); cache.delete(it.id); } renderGrid(); toast('Video dihapus'); } catch (err) { toast(err.message); }
    }
  });
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener('change', () => { [...fileIn.files].forEach(f => upload(f)); fileIn.value = ''; });
  ['dragenter', 'dragover'].forEach(t => vt.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => vt.addEventListener(t, e => { e.preventDefault(); if (t === 'drop' || e.target === drop) drop.classList.remove('over'); }));
  vt.addEventListener('drop', e => { [...(e.dataTransfer?.files || [])].filter(f => /^video\//.test(f.type) || /\.(mp4|webm|mov|mkv|m4v)$/i.test(f.name)).forEach(f => upload(f)); });

  function job(name) {
    const el = document.createElement('div'); el.className = 'vt-job';
    el.innerHTML = `<div class="row"><span class="nm">${esc(name)}</span><span class="pct">0%</span></div><div class="vt-bar"><i></i></div>`;
    jobs.prepend(el);
    return {
      set(p, label) { $('.pct', el).textContent = label || Math.round(p * 100) + '%'; $('i', el).style.width = (p * 100) + '%'; },
      fail(msg) { el.classList.add('err'); $('.pct', el).textContent = msg; setTimeout(() => el.remove(), 8000); },
      done() { $('.pct', el).textContent = 'Tersimpan ✓'; $('i', el).style.width = '100%'; setTimeout(() => el.remove(), 2500); },
    };
  }

  async function upload(file) {
    const j = job(file.name);
    try {
      const init = await (await api('init', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: file.name, size: file.size, type: file.type || 'video/mp4' }) })).json();
      const size = init.chunk, n = init.chunks; let sent = 0, next = 0;
      const worker = async () => {
        while (next < n) {
          const i = next++;
          const part = file.slice(i * size, Math.min(file.size, (i + 1) * size));
          await retry(() => api(`chunk?id=${init.id}&n=${i}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: part }));
          sent += part.size; j.set(sent / file.size);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, n) }, worker));
      const done = await (await retry(() => api('done?id=' + init.id, { method: 'POST' }))).json();
      cache.set(done.item.id, URL.createObjectURL(file));
      items.unshift(done.item); renderGrid(); j.done();
      return done.item;
    } catch (e) { j.fail(e.message || 'Gagal'); throw e; }
  }

  async function fetchVideo(it, onp) {
    if (cache.has(it.id)) return cache.get(it.id);
    const parts = new Array(it.chunks); let got = 0, next = 0;
    const worker = async () => {
      while (next < it.chunks) {
        const i = next++;
        parts[i] = await retry(async () => (await api(`chunk?id=${it.id}&n=${i}`)).blob());
        got += parts[i].size; onp?.(got / it.size);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, it.chunks) }, worker));
    const url = URL.createObjectURL(new Blob(parts, { type: it.type || 'video/mp4' }));
    cache.set(it.id, url);
    return url;
  }
  const loading = new Map();
  function load(it) {
    if (!loading.has(it.id)) {
      const j = cache.has(it.id) ? null : job('Memuat ' + it.name);
      loading.set(it.id, fetchVideo(it, p => j?.set(p)).then(u => { j?.done(); return u; }, e => { j?.fail(e.message); throw e; }).finally(() => loading.delete(it.id)));
    }
    return loading.get(it.id);
  }
  async function download(it) {
    try {
      const url = await load(it);
      const a = document.createElement('a'); a.href = url; a.download = it.name; document.body.appendChild(a); a.click(); a.remove();
      renderGrid();
    } catch (e) { toast(e.message || 'Gagal mengunduh'); }
  }
  async function play(it) {
    try { const url = await load(it); playing = it; pv.src = url; player.hidden = false; pv.play().catch(() => {}); renderGrid(); }
    catch (e) { toast(e.message || 'Gagal memutar'); }
  }

  /* ---------- record the Beranda motion (Usagi-chan show) straight into the vault ---------- */
  let recording = false;
  async function record() {
    const show = window.UsagiShow; if (!show || recording) return;
    const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    closeVault();
    if (typeof window.switchMode === 'function') window.switchMode('home');
    const frame = document.getElementById('vs-frame') || show.stage;
    let screen;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' });
    } catch { openVault(); toast('Rekaman dibatalkan'); return; }
    recording = true;
    const [vtrack] = screen.getVideoTracks();
    frame.scrollIntoView({ block: 'center' });
    try { if (window.CropTarget && vtrack.cropTo) await vtrack.cropTo(await CropTarget.fromElement(show.stage)); } catch {}
    const pill = document.createElement('div'); pill.className = 'rc-pill';
    pill.innerHTML = '<i></i><span>Merekam motion…</span><button type="button">Stop</button>';
    const count = document.createElement('div'); count.className = 'rc-count';
    document.body.append(pill, count);
    show.audio.pause(); show.audio.currentTime = 0;
    for (const n of [3, 2, 1]) { count.textContent = n; await new Promise(r => setTimeout(r, 800)); }
    count.remove();
    await new Promise(r => setTimeout(r, 250));

    const chunks = []; let rec, stopped = false;
    const finish = () => {
      if (stopped) return; stopped = true;
      if (rec && rec.state !== 'inactive') { try { rec.stop(); return; } catch {} }
      screen.getTracks().forEach(t => t.stop()); pill.remove(); recording = false; show.audio.pause(); openVault();
    };
    show.audio.addEventListener('playing', () => {
      const atracks = show.audio.captureStream().getAudioTracks();
      rec = new MediaRecorder(new MediaStream([vtrack, ...atracks]), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 8e6 });
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        screen.getTracks().forEach(t => t.stop()); pill.remove(); recording = false;
        show.audio.pause();
        const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
        const blob = new Blob(chunks, { type });
        openVault();
        if (!blob.size) { toast('Rekaman kosong'); return; }
        const d = new Date(), pad = x => String(x).padStart(2, '0');
        const name = `Usagi-chan motion ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
        try { await upload(new File([blob], name, { type })); toast('Rekaman tersimpan di koleksi'); }
        catch { toast('Gagal menyimpan — mengunduh langsung'); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
      };
      rec.start(1000);
    }, { once: true });
    show.audio.addEventListener('ended', () => setTimeout(finish, 600), { once: true });
    vtrack.addEventListener('ended', finish, { once: true });
    $('button', pill).addEventListener('click', finish);
    show.restart();
  }

  // re-validate a stored session quietly
  if (token) api('check').catch(() => {});
})();
