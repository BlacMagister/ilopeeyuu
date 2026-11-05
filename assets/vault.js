/* Header ☰ menu → cute login → "Ruang Rahasia" (private space, /api/vault).
   Inside: home dashboard, motion-video collection, love letters, mood diary,
   shared bucket list, daily omikuji and a "kangen" button.
   Motion videos generated for this site are added to the vault automatically on the server
   (vault-motions/), so there is nothing to upload or record here — just watch and download. */
(() => {
  const API = '/api/vault/';
  const TK = 'sk_session';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = b => b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
  const fmtDate = t => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let token = localStorage.getItem(TK) || '';
  let items = [], chunkSize = 3 * 1024 * 1024;
  const cache = new Map(); // id -> object URL of the assembled video
  const thumbs = new Map(); // id -> object URL of a poster image

  async function api(path, opts = {}) {
    const res = await fetch(API + path, { ...opts, headers: { ...(opts.headers || {}), ...(token ? { authorization: 'Bearer ' + token } : {}) } });
    if (res.status === 401 && path !== 'login') { logout(true); throw new Error('Sesi berakhir'); }
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Gagal (' + res.status + ')'); }
    return res;
  }
  const send = (path, method, data) => api(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data || {}) }).then(r => r.json());
  const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || /Sesi/.test(e.message)) throw e; await new Promise(r => setTimeout(r, 800 * (i + 1))); } } };

  function toast(msg) {
    $$('.vt-toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'vt-toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }

  /* little heart / sparkle bursts used all over the room */
  function burst(x, y, chars = ['💗', '💖', '✨', '🌸', '💕'], n = 12) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span'); s.className = 'rr-burst';
      s.textContent = chars[i % chars.length];
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
      s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;--r:${Math.random() * 120 - 60}deg;font-size:${14 + Math.random() * 14}px`;
      document.body.appendChild(s); setTimeout(() => s.remove(), 1100);
    }
  }
  const burstAt = (el, chars, n) => { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, chars, n); };
  function confetti() {
    if (reduced) return;
    const colors = ['#ff9bc3', '#c9a7ff', '#9be3c4', '#ffd38a', '#8fd3ff'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('i'); c.className = 'rr-conf';
      c.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % 5]};--dx:${Math.random() * 160 - 80}px;animation-delay:${Math.random() * .4}s;animation-duration:${2.2 + Math.random() * 1.4}s`;
      document.body.appendChild(c); setTimeout(() => c.remove(), 4200);
    }
  }

  /* ---------- tabs of the private room ---------- */
  const TABS = [
    { id: 'home', ic: '🏡', name: 'Beranda', sub: 'Selamat datang kembali' },
    { id: 'gift', ic: '💝', name: 'Untukmu', sub: 'Hadiah-hadiah kecil dari aku, khusus buat kamu' },
    { id: 'video', ic: '🎞️', name: 'Koleksi Video', sub: 'Motion video spesial, siap ditonton & diunduh' },
    { id: 'notes', ic: '💌', name: 'Surat Cinta', sub: 'Tulis pesan manis, tempel di papan' },
    { id: 'mood', ic: '🌈', name: 'Mood Diary', sub: 'Gimana perasaanmu hari ini?' },
    { id: 'dream', ic: '⭐', name: 'Mimpi Bareng', sub: 'Daftar hal yang mau kita lakukan' },
    { id: 'omikuji', ic: '🎋', name: 'Omikuji', sub: 'Ramalan keberuntungan harian ala kuil Jepang' },
    { id: 'play', ic: '🎮', name: 'Main Yuk', sub: 'Game-game gemes buat kita berdua' },
    { id: 'fun', ic: '🎡', name: 'Seru-seru', sub: 'Mainan kecil buat ngusir bosan & bikin senyum' },
  ];

  /* ---------- menu ---------- */
  const btn = $('#menu-btn'); if (!btn) return;
  const pop = document.createElement('div'); pop.className = 'mn-pop'; pop.hidden = true; pop.setAttribute('role', 'menu');
  document.body.appendChild(pop);
  function renderMenu() {
    pop.innerHTML = token
      ? `<div class="mn-hd"><span class="mn-av">🐰</span><div><b>Ruang Rahasia</b><small>kamu sudah masuk ♡</small></div></div>`
        + TABS.map(t => `<button type="button" role="menuitem" data-a="tab" data-t="${t.id}"><span class="mn-ic">${t.ic}</span>${t.name}</button>`).join('')
        + `<hr><button type="button" role="menuitem" data-a="out" class="mn-out"><span class="mn-ic">👋</span>Keluar</button>`
      : `<div class="mn-hd"><span class="mn-av">🔒</span><div><b>Ruang Rahasia</b><small>khusus orang spesial</small></div></div>
         <button type="button" role="menuitem" data-a="login" class="mn-login"><span class="mn-ic">🗝️</span>Masuk</button>`;
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
  addEventListener('keydown', e => { if (e.key === 'Escape') { const letter = !vt.hidden && vt.querySelector('.lv-modal'); if (!pop.hidden) toggleMenu(false); else if (!lg.hidden) closeLogin(); else if (!player.hidden) closePlayer(); else if (letter) { letter.remove(); renderGift(); } else if (!vt.hidden) closeVault(); } });
  pop.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'), a = b?.dataset.a; if (!a) return;
    toggleMenu(false);
    if (a === 'login') openLogin(); else if (a === 'tab') openVault(b.dataset.t); else if (a === 'out') logout();
  });

  /* ---------- login: a shy bunny that covers its eyes while you type the password ---------- */
  const BUNNY = `<svg viewBox="0 0 160 150" aria-hidden="true">
    <defs><radialGradient id="bnF" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fdeef5"/></radialGradient></defs>
    <g class="bn-ears">
      <g class="bn-ear l"><ellipse cx="55" cy="38" rx="15" ry="36" fill="url(#bnF)" stroke="#f3c6d9" stroke-width="2"/><ellipse cx="55" cy="40" rx="7" ry="25" fill="#ffc2da"/></g>
      <g class="bn-ear r"><ellipse cx="105" cy="38" rx="15" ry="36" fill="url(#bnF)" stroke="#f3c6d9" stroke-width="2"/><ellipse cx="105" cy="40" rx="7" ry="25" fill="#ffc2da"/></g>
    </g>
    <circle cx="80" cy="92" r="50" fill="url(#bnF)" stroke="#f3c6d9" stroke-width="2"/>
    <path d="M64 50 q16 -10 32 0" fill="none" stroke="#ff9bc3" stroke-width="5" stroke-linecap="round" class="bn-bow-band"/>
    <g class="bn-bow" transform="translate(104 52)"><path d="M0 0 l-14 -9 v18z M0 0 l14 -9 v18z" fill="#ff7fb0"/><circle r="4.5" fill="#ff5d9c"/></g>
    <g class="bn-eyes">
      <g class="bn-open"><ellipse cx="62" cy="88" rx="6.5" ry="8" fill="#4a2a3b"/><ellipse cx="98" cy="88" rx="6.5" ry="8" fill="#4a2a3b"/><circle cx="64.5" cy="85" r="2.4" fill="#fff"/><circle cx="100.5" cy="85" r="2.4" fill="#fff"/></g>
      <g class="bn-happy"><path d="M55 90 q7 -9 14 0 M91 90 q7 -9 14 0" fill="none" stroke="#4a2a3b" stroke-width="3.5" stroke-linecap="round"/></g>
      <g class="bn-sad"><path d="M55 86 l13 5 M105 86 l-13 5" stroke="#4a2a3b" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="62" cy="94" rx="4" ry="5" fill="#4a2a3b"/><ellipse cx="98" cy="94" rx="4" ry="5" fill="#4a2a3b"/><path d="M57 101 q-3 6 0 9 q3 -3 0 -9z" fill="#8fd3ff"/></g>
    </g>
    <ellipse cx="48" cy="104" rx="9" ry="5.5" fill="#ffb3cf" opacity=".75"/><ellipse cx="112" cy="104" rx="9" ry="5.5" fill="#ffb3cf" opacity=".75"/>
    <path d="M76 99 q4 3 8 0 l-4 4z" fill="#ff8fb7"/>
    <path class="bn-mouth" d="M73 107 q7 7 14 0" fill="none" stroke="#4a2a3b" stroke-width="2.6" stroke-linecap="round"/>
    <g class="bn-paws">
      <g class="bn-paw l"><ellipse cx="0" cy="0" rx="17" ry="14" fill="#fff" stroke="#f3c6d9" stroke-width="2"/><circle cx="-6" cy="-4" r="3" fill="#ffc2da"/><circle cx="1" cy="-7" r="3" fill="#ffc2da"/><circle cx="7" cy="-3" r="3" fill="#ffc2da"/></g>
      <g class="bn-paw r"><ellipse cx="0" cy="0" rx="17" ry="14" fill="#fff" stroke="#f3c6d9" stroke-width="2"/><circle cx="-7" cy="-3" r="3" fill="#ffc2da"/><circle cx="-1" cy="-7" r="3" fill="#ffc2da"/><circle cx="6" cy="-4" r="3" fill="#ffc2da"/></g>
    </g>
  </svg>`;
  const lg = document.createElement('div'); lg.className = 'lg-back'; lg.hidden = true;
  lg.innerHTML = `<div class="lg-floaty" aria-hidden="true">${['💗', '🌸', '✨', '💕', '🎀', '⭐', '🌷', '💖', '☁️', '🍓'].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}</div>
  <form class="lg-card" role="dialog" aria-modal="true" aria-labelledby="lg-t" novalidate>
    <button type="button" class="lg-x" aria-label="Tutup">✕</button>
    <div class="lg-bun" data-s="idle">${BUNNY}<div class="lg-say" aria-hidden="true">psst… siapa itu? 👀</div></div>
    <span class="lg-chip">🔒 ruang rahasia · ひみつ</span>
    <h2 id="lg-t">Okaerinasai~ <span class="jp">おかえり</span></h2>
    <p class="lg-sub">Masuk dulu yuk, ada yang lagi nungguin kamu di dalam 💗</p>
    <div class="lg-field"><span class="lg-ic" aria-hidden="true">🐰</span><input id="lg-u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder=" " required><label for="lg-u">Username</label></div>
    <div class="lg-field"><span class="lg-ic" aria-hidden="true">🗝️</span><input id="lg-p" name="password" type="password" autocomplete="current-password" placeholder=" " required><label for="lg-p">Password</label>
      <button type="button" class="lg-eye" aria-label="Tampilkan password" aria-pressed="false">🙈</button></div>
    <div class="lg-caps" hidden>⇪ Caps Lock lagi nyala nih</div>
    <div class="lg-err" aria-live="polite"></div>
    <button class="lg-go" type="submit"><span class="lb">Masuk</span><span class="hr" aria-hidden="true">♡</span></button>
    <small class="lg-foot">dibuat dengan ♡ cuma buat kamu</small>
  </form>`;
  document.body.appendChild(lg);
  const lgForm = $('form', lg), lgErr = $('.lg-err', lg), lgGo = $('.lg-go', lg), bun = $('.lg-bun', lg), say = $('.lg-say', lg);
  const lgU = $('#lg-u', lg), lgP = $('#lg-p', lg), eye = $('.lg-eye', lg);
  const bunState = s => { bun.dataset.s = s; };
  const bunSay = t => { say.textContent = t; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop'); };
  const look = () => { const v = lgU.value.length; bun.style.setProperty('--look', (Math.min(v, 24) / 24 * 8 - 4).toFixed(1) + 'px'); };
  lgU.addEventListener('focus', () => { bunState('idle'); look(); bunSay(lgU.value ? 'hmm hmm… ✍️' : 'siapa namamu? 🥺'); });
  lgU.addEventListener('input', () => { look(); if (bun.dataset.s !== 'idle') bunState('idle'); });
  lgU.addEventListener('blur', () => bun.style.setProperty('--look', '0px'));
  lgP.addEventListener('focus', () => { bunState(lgP.type === 'text' ? 'peek' : 'hide'); bunSay(lgP.type === 'text' ? 'ngintip dikit ya 🫣' : 'aku gak liat kok! 🙈'); });
  lgP.addEventListener('blur', () => { if (bun.dataset.s === 'hide' || bun.dataset.s === 'peek') bunState('idle'); });
  const caps = $('.lg-caps', lg);
  lgP.addEventListener('keyup', e => { caps.hidden = !e.getModifierState?.('CapsLock'); });
  eye.addEventListener('click', () => {
    const show = lgP.type === 'password'; lgP.type = show ? 'text' : 'password';
    eye.textContent = show ? '🐵' : '🙈'; eye.setAttribute('aria-pressed', String(show)); eye.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
    lgP.focus(); bunState(show ? 'peek' : 'hide');
  });
  function openLogin() {
    lgErr.textContent = ''; lgForm.reset(); lgP.type = 'password'; eye.textContent = '🙈'; caps.hidden = true;
    bunState('idle'); bun.style.setProperty('--look', '0px'); lg.hidden = false;
    setTimeout(() => { lgU.focus(); }, 60);
  }
  function closeLogin() { lg.hidden = true; btn.focus(); }
  $('.lg-x', lg).addEventListener('click', closeLogin);
  lg.addEventListener('click', e => { if (e.target === lg) closeLogin(); });
  lgForm.addEventListener('submit', async e => {
    e.preventDefault();
    const u = lgU.value.trim(), p = lgP.value;
    if (!u || !p) { lgErr.textContent = 'Isi username dan password dulu ya 🥺'; bunState('sad'); bunSay('eh, masih kosong…'); return; }
    lgGo.disabled = true; lgGo.classList.add('busy'); lgErr.textContent = '';
    try {
      const res = await api('login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ u, p }) });
      token = (await res.json()).token; localStorage.setItem(TK, token);
      bunState('happy'); bunSay('yeay! masuk~ 💖'); burstAt(bun, undefined, 16); lgForm.classList.add('ok');
      setTimeout(() => { lg.hidden = true; lgForm.classList.remove('ok'); openVault('home', true); }, reduced ? 50 : 900);
    } catch (err) {
      lgErr.textContent = err.message || 'Gagal masuk'; bunState('sad'); bunSay('hiks, bukan itu… 🥲');
      lgForm.classList.remove('shake'); void lgForm.offsetWidth; lgForm.classList.add('shake');
    } finally { lgGo.disabled = false; lgGo.classList.remove('busy'); }
  });

  function logout(expired) {
    token = ''; localStorage.removeItem(TK);
    cache.forEach(u => URL.revokeObjectURL(u)); cache.clear(); items = [];
    thumbs.forEach(u => u && URL.revokeObjectURL(u)); thumbs.clear();
    moments.splice(0).forEach(m => URL.revokeObjectURL(m.url)); renderMoments();
    roomData = null;
    closeVault(); toast(expired ? 'Sesi berakhir, silakan masuk lagi' : 'Sampai jumpa lagi~ 👋💗');
  }

  /* ---------- the private room ---------- */
  const THEMES = [['sakura', '#ff8fbc', 'Sakura'], ['lavender', '#b79cff', 'Lavender'], ['matcha', '#7fcf9f', 'Matcha'], ['peach', '#ffb38a', 'Peach'], ['night', '#3b3363', 'Malam']];
  const vt = document.createElement('div'); vt.className = 'vt'; vt.hidden = true;
  vt.dataset.theme = THEMES.some(t => t[0] === localStorage.getItem('rr_theme')) ? localStorage.getItem('rr_theme') : 'sakura';
  vt.setAttribute('role', 'dialog'); vt.setAttribute('aria-modal', 'true'); vt.setAttribute('aria-label', 'Ruang Rahasia');
  vt.innerHTML = `<div class="rr-sky" aria-hidden="true"><b></b><b></b><b></b>${Array.from({ length: 10 }, (_, i) => `<i style="--i:${i}">${['🌸', '✿', '♡', '✨', '☁️'][i % 5]}</i>`).join('')}</div>
  <div class="rr">
    <aside class="rr-nav">
      <div class="rr-brand"><div class="rr-logo">🐰</div><div><b>Ruang Rahasia</b><small>ひみつの部屋</small></div></div>
      <nav class="rr-tabs" aria-label="Menu ruang rahasia">${TABS.map(t => `<button type="button" data-tab="${t.id}"><span class="ic">${t.ic}</span><span class="nm">${t.name}</span></button>`).join('')}</nav>
      <div class="rr-side-foot">
        <div class="rr-themes" role="group" aria-label="Tema warna">${THEMES.map(([k, c, n]) => `<button type="button" data-theme="${k}" style="--c:${c}" title="Tema ${n}" aria-label="Tema ${n}"></button>`).join('')}</div>
        <button type="button" class="rr-out" data-v="out">👋 Keluar</button>
      </div>
    </aside>
    <main class="rr-main">
      <div class="rr-top">
        <div><h2 class="rr-title"></h2><small class="rr-sub"></small></div>
        <button type="button" class="rr-icon" data-v="close" title="Kembali ke web (Esc)" aria-label="Tutup">✕</button>
      </div>
      <section class="rr-panel" data-panel="home"></section>
      <section class="rr-panel" data-panel="video" hidden>
        <div class="vt-jobs"></div>
        <div class="vt-head"><h3>Semua video</h3><span class="vt-sum"></span></div>
        <div class="vt-grid"></div>
      </section>
      <section class="rr-panel" data-panel="notes" hidden></section>
      <section class="rr-panel" data-panel="mood" hidden></section>
      <section class="rr-panel" data-panel="dream" hidden></section>
      <section class="rr-panel" data-panel="omikuji" hidden></section>
      <section class="rr-panel" data-panel="gift" hidden></section>
      <section class="rr-panel" data-panel="play" hidden></section>
      <section class="rr-panel" data-panel="fun" hidden></section>
    </main>
    <div class="lv-pet"><div class="lv-bubble" hidden aria-live="polite"></div><button type="button" class="lv-pet-b" data-l="pet" aria-label="Usagi-chan">🐰</button></div>
  </div>`;
  document.body.appendChild(vt);
  const grid = $('.vt-grid', vt), jobs = $('.vt-jobs', vt), sum = $('.vt-sum', vt);

  /* ---------- player + Studio Momen (speed, loop, resume, snapshot, clip maker) ---------- */
  const fmtT = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
  const player = document.createElement('div'); player.className = 'vt-player'; player.hidden = true;
  player.setAttribute('role', 'dialog'); player.setAttribute('aria-modal', 'true'); player.setAttribute('aria-label', 'Pemutar video');
  player.innerHTML = `<div class="vp-wrap"><video controls playsinline></video><div class="vp-flash"></div><div class="vp-rec" hidden><i></i><span>Merekam klip…</span></div></div>
    <div class="vp-studio">
      <div class="vp-row">
        <div class="vp-speed" role="group" aria-label="Kecepatan">${[0.5, 1, 1.5, 2].map(r => `<button type="button" data-r="${r}"${r === 1 ? ' class="on"' : ''}>${r}×</button>`).join('')}</div>
        <button type="button" class="vt-btn" data-p="loop" aria-pressed="false" title="Ulangi (L)">🔁 Ulang</button>
        <button type="button" class="vt-btn" data-p="snap" title="Ambil foto (S)">📸 Foto</button>
        <button type="button" class="vt-btn" data-p="clip" aria-expanded="false" title="Buat klip pendek">✂️ Klip</button>
        <button type="button" class="vt-btn pri" data-p="dl">⬇ Unduh</button>
        <button type="button" class="vt-btn" data-p="x">Tutup</button>
      </div>
      <div class="vp-clip" hidden>
        <div class="vp-tl" title="Ketuk untuk lompat"><b class="vp-sel"></b><i class="vp-head"></i></div>
        <div class="vp-row">
          <button type="button" class="vt-btn" data-p="in" title="Tandai mulai ([)">⟦ Mulai <span class="t-in">0:00.0</span></button>
          <button type="button" class="vt-btn" data-p="out" title="Tandai selesai (])">Selesai <span class="t-out">0:00.0</span> ⟧</button>
          <span class="vp-len"></span>
          <button type="button" class="vt-btn pri" data-p="make">🎬 Buat klip</button>
        </div>
        <div class="vp-hint">Putar ke bagian favoritmu, tandai mulai &amp; selesai (maks. 60 detik), lalu buat klip lengkap dengan suara — siap dibagikan.</div>
      </div>
      <div class="vp-moments" hidden><div class="vp-mh">Momen <small>ketuk untuk simpan / bagikan</small></div><div class="vp-strip"></div></div>
      <div class="vp-keys">Pintasan: <kbd>Spasi</kbd> putar · <kbd>←</kbd><kbd>→</kbd> 5 dtk · <kbd>,</kbd><kbd>.</kbd> per frame · <kbd>S</kbd> foto · <kbd>[</kbd><kbd>]</kbd> mulai/selesai · <kbd>L</kbd> ulang</div>
    </div>`;
  document.body.appendChild(player);
  const pv = $('video', player), clipBox = $('.vp-clip', player), strip = $('.vp-strip', player), tl = $('.vp-tl', player);
  let playing = null, clipIn = 0, clipOut = 0, recording = null, lastSave = 0;
  const moments = []; // { blob, url, name }
  const MAX_CLIP = 60;
  const baseName = it => it.name.replace(/\.[a-z0-9]{2,4}$/i, '');

  function closePlayer() {
    if (recording) recording.abort();
    if (playing && pv.currentTime) savePos();
    pv.pause(); pv.removeAttribute('src'); pv.load(); player.hidden = true; playing = null;
  }
  const posKey = () => 'vt_pos_' + playing.id;
  function savePos() {
    if (!playing) return;
    const d = pv.duration || 0, t = pv.currentTime;
    if (t > 3 && d && t < d - 3) localStorage.setItem(posKey(), String(t)); else localStorage.removeItem(posKey());
  }
  pv.addEventListener('timeupdate', () => {
    if (!recording && Date.now() - lastSave > 2000) { lastSave = Date.now(); savePos(); }
    drawTimeline();
  });
  pv.addEventListener('ended', () => { if (playing) localStorage.removeItem(posKey()); });
  pv.addEventListener('loadedmetadata', () => {
    clipIn = 0; clipOut = Math.min(pv.duration || 0, 10); updClip();
    const t = playing && Number(localStorage.getItem(posKey()));
    if (t > 3 && t < pv.duration - 3) { pv.currentTime = t; toast('Lanjut dari ' + fmtT(t).replace(/\.\d$/, '')); }
  });

  function setRate(r) {
    pv.playbackRate = r;
    player.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', Number(b.dataset.r) === r));
  }
  function setLoop(on) {
    pv.loop = on; const b = $('[data-p="loop"]', player); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on);
  }

  /* timeline for the clip range */
  function drawTimeline() {
    const d = pv.duration; if (!d || clipBox.hidden) return;
    $('.vp-head', tl).style.left = (pv.currentTime / d * 100) + '%';
  }
  function updClip() {
    const d = pv.duration || 0;
    if (clipOut < clipIn) [clipIn, clipOut] = [clipOut, clipIn];
    $('.t-in', player).textContent = fmtT(clipIn); $('.t-out', player).textContent = fmtT(clipOut);
    const len = clipOut - clipIn, ok = len >= 0.5 && len <= MAX_CLIP;
    const lenEl = $('.vp-len', player);
    lenEl.textContent = len > MAX_CLIP ? `${len.toFixed(1)} dtk — terlalu panjang` : `${len.toFixed(1)} dtk`;
    lenEl.classList.toggle('bad', !ok);
    $('[data-p="make"]', player).disabled = !ok || !!recording;
    if (d) { const sel = $('.vp-sel', tl); sel.style.left = (clipIn / d * 100) + '%'; sel.style.width = ((clipOut - clipIn) / d * 100) + '%'; }
    drawTimeline();
  }
  tl.addEventListener('click', e => {
    if (!pv.duration || recording) return;
    const r = tl.getBoundingClientRect(); pv.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * pv.duration;
  });

  /* snapshot: current frame → PNG with a small stamp, kept in the Momen strip */
  function frameCanvas() {
    const c = document.createElement('canvas'); c.width = pv.videoWidth; c.height = pv.videoHeight;
    c.getContext('2d').drawImage(pv, 0, 0, c.width, c.height); return c;
  }
  function snapshot() {
    if (!playing || !pv.videoWidth) return;
    const c = frameCanvas(), g = c.getContext('2d'), t = pv.currentTime;
    const fs = Math.round(c.height / 38), label = `▶ Motion Vault · ${fmtT(t)}`;
    g.font = `700 ${fs}px "DM Sans", system-ui, sans-serif`;
    const w = g.measureText(label).width + fs * 1.4, h = fs * 1.9, x = c.width - w - fs, y = c.height - h - fs;
    g.fillStyle = 'rgba(13,12,15,.55)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, h / 2) : g.rect(x, y, w, h); g.fill();
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(label, x + fs * .7, y + h / 2);
    const fl = $('.vp-flash', player); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    c.toBlob(blob => blob && addMoment(blob, `${baseName(playing)} - foto ${fmtT(t).replace(':', '.')}.png`, 'Foto disimpan di Momen'), 'image/png');
  }
  function addMoment(blob, name, msg) {
    const m = { blob, name, url: URL.createObjectURL(blob), video: blob.type.startsWith('video') };
    moments.unshift(m); renderMoments(); toast(msg);
  }
  function renderMoments() {
    $('.vp-moments', player).hidden = !moments.length;
    strip.innerHTML = moments.map((m, i) => `<button type="button" class="vp-m${m.video ? ' vid' : ''}" data-m="${i}" title="${esc(m.name)}">${m.video ? `<video src="${m.url}#t=0.1" muted playsinline preload="metadata"></video><span>🎬</span>` : `<img src="${m.url}" alt="">`}</button>`).join('');
  }
  async function shareOrSave(m) {
    const file = new File([m.blob], m.name, { type: m.blob.type });
    if (matchMedia('(pointer:coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: m.name }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = m.url; a.download = m.name; document.body.appendChild(a); a.click(); a.remove();
  }
  strip.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) shareOrSave(moments[b.dataset.m]); });

  /* clip maker: re-records the chosen range (picture + sound) in real time */
  let audio = null; // { ctx, dest } — the element can only be routed into Web Audio once
  function audioTrack() {
    try {
      if (!audio) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaElementSource(pv), dest = ctx.createMediaStreamDestination();
        src.connect(ctx.destination); src.connect(dest); audio = { ctx, dest };
      }
      audio.ctx.resume?.();
      return audio.dest.stream.getAudioTracks()[0];
    } catch { return null; }
  }
  const pickMime = () => ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find(t => window.MediaRecorder?.isTypeSupported?.(t));
  async function makeClip() {
    if (recording || !playing) return;
    const mime = pickMime(), c = document.createElement('canvas');
    if (!mime || !c.captureStream) return toast('Browser ini belum bisa membuat klip — coba Chrome atau Safari terbaru');
    const it = playing, a = clipIn, b = clipOut;
    c.width = pv.videoWidth; c.height = pv.videoHeight;
    const g = c.getContext('2d'), stream = c.captureStream(30), at = audioTrack();
    if (at) stream.addTrack(at);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5e6 });
    const parts = []; let aborted = false, raf = 0;
    rec.ondataavailable = e => e.data.size && parts.push(e.data);
    const wasLoop = pv.loop, wasRate = pv.playbackRate;
    const cleanup = () => {
      cancelAnimationFrame(raf); pv.removeEventListener('timeupdate', tick); pv.removeEventListener('ended', stop);
      stream.getVideoTracks().forEach(t => t.stop());
      pv.controls = true; setLoop(wasLoop); setRate(wasRate);
      $('.vp-rec', player).hidden = true; player.classList.remove('recording'); recording = null; updClip();
    };
    const stop = () => { if (rec.state !== 'inactive') rec.stop(); pv.pause(); };
    const tick = () => { if (pv.currentTime >= b) stop(); };
    const draw = () => { g.drawImage(pv, 0, 0, c.width, c.height); raf = requestAnimationFrame(draw); };
    rec.onstop = () => {
      cleanup();
      if (aborted || !parts.length) return;
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      addMoment(new Blob(parts, { type: mime.split(';')[0] }), `${baseName(it)} - klip ${fmtT(a).replace(':', '.')}-${fmtT(b).replace(':', '.')}.${ext}`, 'Klip jadi! Ada di Momen 🎬');
    };
    recording = { abort() { aborted = true; stop(); } };
    pv.controls = false; setLoop(false); setRate(1);
    $('.vp-rec', player).hidden = false; player.classList.add('recording'); updClip();
    pv.pause(); pv.currentTime = a;
    await new Promise(r => pv.addEventListener('seeked', r, { once: true }));
    if (aborted) return cleanup();
    g.drawImage(pv, 0, 0, c.width, c.height); draw();
    pv.addEventListener('timeupdate', tick); pv.addEventListener('ended', stop);
    rec.start(250);
    pv.play().catch(() => recording?.abort());
  }

  function step(dt) { if (!pv.duration || recording) return; pv.pause(); pv.currentTime = Math.min(pv.duration, Math.max(0, pv.currentTime + dt)); }

  player.addEventListener('click', e => {
    const r = e.target.closest('[data-r]'); if (r && !recording) return setRate(Number(r.dataset.r));
    const a = e.target.closest('[data-p]')?.dataset.p;
    if (a === 'x' || e.target === player) closePlayer();
    else if (a === 'dl' && playing) download(playing);
    else if (recording) return;
    else if (a === 'loop') setLoop(!pv.loop);
    else if (a === 'snap') snapshot();
    else if (a === 'clip') { clipBox.hidden = !clipBox.hidden; $('[data-p="clip"]', player).setAttribute('aria-expanded', String(!clipBox.hidden)); updClip(); }
    else if (a === 'in') { clipIn = pv.currentTime; if (clipOut <= clipIn) clipOut = Math.min(pv.duration, clipIn + 10); updClip(); }
    else if (a === 'out') { clipOut = pv.currentTime; updClip(); }
    else if (a === 'make') makeClip();
  });
  addEventListener('keydown', e => {
    if (player.hidden || !lg.hidden || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key, ks = k.toLowerCase();
    if (k === 'Escape') return;
    if (recording) { if (k === ' ') e.preventDefault(); return; }
    if (k === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); pv.paused ? pv.play() : pv.pause(); }
    else if (k === 'ArrowLeft' && e.target !== pv) { e.preventDefault(); step(-5); }
    else if (k === 'ArrowRight' && e.target !== pv) { e.preventDefault(); step(5); }
    else if (k === ',') step(-1 / 30);
    else if (k === '.') step(1 / 30);
    else if (ks === 's') snapshot();
    else if (ks === 'l') setLoop(!pv.loop);
    else if (k === '[' || k === ']') {
      if (clipBox.hidden) { clipBox.hidden = false; $('[data-p="clip"]', player).setAttribute('aria-expanded', 'true'); }
      $(`[data-p="${k === '[' ? 'in' : 'out'}"]`, player).click();
    }
  });

  /* ---------- room: open / close / tabs ---------- */
  let tab = 'home', roomData = null, roomLoading = null, built = false;
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const seeded = str => { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };
  const pickR = (rnd, a) => a[Math.floor(rnd() * a.length)];

  async function openVault(t = tab, fresh = false) {
    if (!token) return openLogin();
    if (!built) buildPanels();
    vt.hidden = false; document.body.classList.add('vt-open');
    if (fresh) { vt.classList.remove('enter'); void vt.offsetWidth; vt.classList.add('enter'); }
    trackVisit(); switchTab(t);
    loadRoom(); refresh();
  }
  function closeVault() { if (game) endGame(true); $$('.lv-modal', vt).forEach(m => m.remove()); const was = !vt.hidden; vt.hidden = true; document.body.classList.remove('vt-open'); closePlayer(); if (was) btn.focus(); }
  function switchTab(t) {
    tab = TABS.some(x => x.id === t) ? t : 'home';
    const info = TABS.find(x => x.id === tab);
    $('.rr-title', vt).textContent = info.ic + ' ' + info.name;
    $('.rr-sub', vt).textContent = info.sub;
    $$('[data-tab]', vt).forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); if (on && b.closest('.rr-tabs') && matchMedia('(max-width:820px)').matches) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); });
    $$('.rr-panel', vt).forEach(p => { p.hidden = p.dataset.panel !== tab; });
    $('.rr-main', vt).scrollTop = 0; vt.scrollTop = 0;
    renderTab();
  }
  function renderTab() {
    if (tab === 'home') renderHome(); else if (tab === 'notes') renderBoard(); else if (tab === 'mood') renderMood();
    else if (tab === 'dream') renderDreams(); else if (tab === 'omikuji') renderOmikuji();
    else if (tab === 'gift') renderGift(); else if (tab === 'play') renderPlay(); else if (tab === 'fun') renderFun();
    if (tab !== 'play' && game) endGame(true);
  }
  async function loadRoom() {
    if (roomLoading) return roomLoading;
    roomLoading = api('room').then(r => r.json()).then(j => { roomData = j; renderTab(); })
      .catch(e => { if (token && !roomData) toast('Gagal memuat ruang: ' + e.message); })
      .finally(() => { roomLoading = null; });
    return roomLoading;
  }

  /* visit streak (per device) */
  function trackVisit() {
    const today = dayKey(), yest = dayKey(new Date(Date.now() - 864e5));
    let v; try { v = JSON.parse(localStorage.getItem('rr_visits')) || {}; } catch { v = {}; }
    if (v.last !== today) { v.streak = v.last === yest ? (v.streak || 0) + 1 : 1; v.total = (v.total || 0) + 1; v.last = today; v.first = v.first || today; }
    localStorage.setItem('rr_visits', JSON.stringify(v));
    return v;
  }
  const visits = () => { try { return JSON.parse(localStorage.getItem('rr_visits')) || {}; } catch { return {}; } };

  /* ---------- static content ---------- */
  const SWEET = [
    'Kamu tuh alasan aku senyum-senyum sendiri hari ini 🌷', 'Jangan lupa minum air putih ya, sayang 💧', 'Pelan-pelan aja belajarnya, aku bangga sama kamu 📚💗',
    'Hari ini kamu cantik banget, beneran deh ✨', 'Kalau capek, istirahat dulu. Aku tetap di sini 🧸', 'Satu kanji sehari, satu pelukan sehari 🫶',
    'Dunia lebih manis sejak ada kamu 🍓', 'Ganbatte ne! がんばってね 🔥', 'Kamu itu daikichi-nya aku 🎋', 'Semoga harimu selembut mochi 🍡',
  ];
  const MOODS = [
    ['bahagia', '😊', 'Bahagia', 'Yeay! Senyummu nular sampai sini 😊💗'], ['semangat', '🔥', 'Semangat', 'Gaskeun! Kamu pasti bisa hari ini 🔥'],
    ['santai', '😌', 'Santai', 'Nikmatin harinya pelan-pelan ya ☁️'], ['kangen', '🥺', 'Kangen', 'Aku juga kangen kamu… banget 🥺💗'],
    ['capek', '😴', 'Capek', 'Istirahat dulu ya, kamu udah hebat hari ini 🛌'], ['sedih', '😢', 'Sedih', 'Peluk jauh dulu ya… semua bakal baik-baik aja 🫂'],
  ];
  const moodOf = k => MOODS.find(m => m[0] === k) || MOODS[0];
  const NOTE_COLORS = ['pink', 'lilac', 'mint', 'peach', 'sky'];
  const STICKERS = ['💌', '🌸', '🐰', '🍓', '⭐', '🧸', '🍰', '☕'];
  const NOTE_IDEAS = [
    'Hal kecil darimu yang bikin aku senyum hari ini: ', 'Aku bersyukur hari ini karena… ', 'Kalau kita ketemu nanti, aku mau… ',
    'Tiga hal yang aku suka dari kamu: 1) ', 'Pesan buat kamu yang lagi belajar: ', 'Kenangan favoritku sama kamu adalah… ',
  ];
  const DREAM_EMO = ['✨', '✈️', '🍜', '🎡', '🎬', '🏖️', '📸', '🗻', '🍰', '🎤'];
  const DREAM_IDEAS = [['🌸', 'Lihat sakura mekar di Jepang'], ['🍜', 'Makan ramen bareng di Tokyo'], ['🎡', 'Naik bianglala pas sunset'], ['🎬', 'Maraton film favorit'], ['📸', 'Photobox lucu berdua'], ['🗻', 'Lihat Gunung Fuji']];
  const OMI_RANKS = [['大吉', 'Daikichi', 'Keberuntungan besar!', 3], ['中吉', 'Chūkichi', 'Keberuntungan sedang', 2], ['小吉', 'Shōkichi', 'Keberuntungan kecil', 2], ['吉', 'Kichi', 'Beruntung', 2], ['末吉', 'Suekichi', 'Keberuntungan datang belakangan', 1]];
  const OMI_TXT = {
    '💗 Cinta': ['Seseorang lagi mikirin kamu sekarang juga.', 'Kirim pesan manis duluan, pasti dibalas dengan senyum.', 'Hari yang pas buat bilang "aku sayang kamu".', 'Pelukan hangat menantimu sebentar lagi.'],
    '📚 Belajar': ['Kanji yang susah hari ini bakal nempel di kepala.', 'Coba 10 menit flashcard, hasilnya bikin kaget.', 'Ulangi yang kemarin, besok jadi juara Duel.', 'Fokusmu tajam seperti katana hari ini.'],
    '🍀 Kesehatan': ['Tidur cukup = kulit glowing ✨', 'Minum air putih 8 gelas ya!', 'Jalan-jalan sore bikin hati adem.', 'Makan buah manis, semanis kamu.'],
    '💰 Rezeki': ['Ada kejutan kecil yang menyenangkan.', 'Jajan boba hari ini dapat bonus kebahagiaan.', 'Rezeki datang dari arah yang tak terduga.', 'Hemat hari ini, senyum lebar besok.'],
  };
  const LUCKY_COLOR = [['Pink sakura', '#ff9bc3'], ['Lavender', '#b79cff'], ['Mint', '#7fdcb3'], ['Kuning lemon', '#ffd86b'], ['Biru langit', '#8fd3ff'], ['Peach', '#ffb38a']];
  const LUCKY_ITEM = ['Boneka kelinci 🐰', 'Teh matcha 🍵', 'Pita rambut 🎀', 'Mochi 🍡', 'Buku catatan 📓', 'Stroberi 🍓', 'Payung lucu ☂️', 'Gantungan kunci ⭐'];
  function omikuji(day = dayKey()) {
    const r = seeded('omikuji:' + day);
    const weighted = OMI_RANKS.flatMap(x => Array(x[3]).fill(x));
    const kd = window.KANJI_DATA || [];
    return {
      rank: pickR(r, weighted), lines: Object.entries(OMI_TXT).map(([k, v]) => [k, pickR(r, v)]),
      color: pickR(r, LUCKY_COLOR), item: pickR(r, LUCKY_ITEM), word: kd.length ? pickR(r, kd) : ['幸せ', 'しあわせ', 'Bahagia'],
    };
  }
  const omiOpened = () => localStorage.getItem('rr_omi') === dayKey();
  function wordOfDay() { const kd = window.KANJI_DATA || []; return kd.length ? pickR(seeded('word:' + dayKey()), kd) : ['好き', 'すき', 'Suka']; }
  function speak(text) {
    if (!('speechSynthesis' in window)) return toast('Browser ini belum bisa bersuara 🥲');
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = .85;
    const v = speechSynthesis.getVoices().find(v => /^ja/i.test(v.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  /* ---------- panels ---------- */
  let noteColor = 'pink', noteSticker = '💌', selMood = '', dreamEmo = '✨';
  function buildPanels() {
    built = true;
    $('[data-panel="notes"]', vt).innerHTML = `<div class="rr-card rr-compose">
        <div class="rr-paper" data-color="pink"><span class="stk">💌</span><textarea maxlength="600" placeholder="Tulis surat kecil di sini… ✍️" aria-label="Isi surat"></textarea></div>
        <div class="rr-row">
          <div class="rr-dots" role="group" aria-label="Warna kertas">${NOTE_COLORS.map(c => `<button type="button" data-ncolor="${c}" class="c-${c}${c === noteColor ? ' on' : ''}" aria-label="Kertas ${c}"></button>`).join('')}</div>
          <div class="rr-stks" role="group" aria-label="Stiker">${STICKERS.map(s => `<button type="button" data-nstk="${s}"${s === noteSticker ? ' class="on"' : ''}>${s}</button>`).join('')}</div>
        </div>
        <div class="rr-row end"><button type="button" class="rr-btn ghost" data-x="idea">💡 Kasih ide</button><span class="rr-count">0/600</span><button type="button" class="rr-btn pri" data-x="note-add">📌 Tempel surat</button></div>
      </div>
      <div class="rr-board"></div>`;
    const ta = $('[data-panel="notes"] textarea', vt);
    ta.addEventListener('input', () => { $('.rr-count', vt).textContent = ta.value.length + '/600'; });

    $('[data-panel="mood"]', vt).innerHTML = `<div class="rr-grid2">
      <div class="rr-card"><h3>Hari ini aku merasa…</h3>
        <div class="rr-moods">${MOODS.map(([k, e, n]) => `<button type="button" data-mood="${k}"><span>${e}</span>${n}</button>`).join('')}</div>
        <input class="rr-input mood-note" maxlength="140" placeholder="Cerita singkat (opsional) ☁️" aria-label="Catatan mood">
        <button type="button" class="rr-btn pri wide" data-x="mood-save">💾 Simpan mood hari ini</button>
        <p class="rr-reply" aria-live="polite"></p></div>
      <div class="rr-card"><h3>Kalender mood <small>5 minggu terakhir</small></h3><div class="rr-cal"></div><div class="rr-moodstat"></div></div>
    </div>`;

    $('[data-panel="dream"]', vt).innerHTML = `<div class="rr-card">
        <form class="rr-dream-add"><button type="button" class="rr-emo" data-x="dream-emo" title="Ganti emoji" aria-label="Ganti emoji">✨</button>
          <input class="rr-input" maxlength="120" placeholder="Mimpi apa yang mau kita wujudkan? 🌙" aria-label="Mimpi baru"><button class="rr-btn pri">➕ Tambah</button></form>
        <div class="rr-prog"><div class="bar"><i></i></div><span></span></div>
      </div>
      <ul class="rr-dreams"></ul>`;
    $('.rr-dream-add', vt).addEventListener('submit', async e => {
      e.preventDefault(); const inp = $('.rr-dream-add input', vt), text = inp.value.trim(); if (!text) return;
      await addDream(text, dreamEmo); inp.value = '';
    });

    $('[data-panel="omikuji"]', vt).innerHTML = `<div class="rr-omi">
      <div class="rr-card rr-omi-stage">
        <div class="omi-box" aria-hidden="true"><div class="omi-stick"></div><div class="omi-face">御<br>神<br>籤</div></div>
        <p class="omi-hint">Kocok kotaknya untuk mengambil ramalan hari ini ✨<br><small>Satu kali sehari — ramalan baru setiap tengah malam</small></p>
        <button type="button" class="rr-btn pri big" data-x="omi">🎋 Kocok omikuji</button>
      </div>
      <div class="omi-paper" hidden></div></div>`;
  }

  function renderHome() {
    const panel = $('[data-panel="home"]', vt), h = new Date().getHours();
    const [hi, jp] = h < 11 ? ['Ohayou', 'おはよう'] : h < 15 ? ['Konnichiwa', 'こんにちは'] : h < 19 ? ['Konnichiwa', 'こんにちは'] : ['Konbanwa', 'こんばんは'];
    const v = visits(), w = wordOfDay(), o = omikuji(), d = roomData;
    const msg = pickR(seeded('sweet:' + dayKey()), SWEET);
    const todayMood = d?.moods.find(m => m.day === dayKey());
    const kangen = (d?.counters?.kangen || 0) + pendingKangen;
    const dreams = d?.bucket || [], done = dreams.filter(x => x.done).length;
    const latest = d?.notes?.[0];
    const date = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    panel.innerHTML = `<div class="rr-hero">
        <div class="tx"><span class="rr-pill">📅 ${esc(date)}</span>
          <h3>${hi}, sayang! <span class="jp">${jp}</span></h3>
          <p>${esc(msg)}</p>
          <div class="chips"><span>🔥 ${v.streak || 1} hari beruntun</span><span>🏡 ${v.total || 1}× mampir</span>${todayMood ? `<span>${moodOf(todayMood.mood)[1]} lagi ${moodOf(todayMood.mood)[2].toLowerCase()}</span>` : ''}</div></div>
        <div class="art" aria-hidden="true"><span class="bunny">🐰</span><span class="h1">💗</span><span class="h2">✨</span><span class="h3">🌸</span></div>
      </div>
      <div class="rr-widgets">
        ${(() => { const tg = together(); return `<div class="rr-card w-days" data-go="gift" role="button" tabindex="0"><h3>Hari bersama 💞</h3>${tg ? `<div class="wd-n">${tg.days.toLocaleString('id-ID')}</div><p>hari sejak kita jadian${tg.isMonthsary ? ' · 🎉 happy monthsary!' : ` · ${tg.toNext} hari lagi ke ${tg.months + 1} bulan`}</p>` : '<div class="wd-n">?</div><p>Isi tanggal jadian kita di tab Untukmu 💝</p>'}</div>`; })()}
        <div class="rr-card w-kangen"><h3>Tombol Kangen</h3><p>Tekan sebanyak kamu kangen 🥺</p>
          <button type="button" class="kangen-btn" data-x="kangen" aria-label="Kirim kangen">💗</button>
          <div class="kangen-n"><b>${kangen.toLocaleString('id-ID')}</b> kali kangen terkirim</div><div class="kangen-lv">${kangenLevel(kangen)}</div></div>
        <div class="rr-card w-mood"><h3>Mood hari ini</h3><p>${todayMood ? 'Tersimpan: ' + moodOf(todayMood.mood)[1] + ' ' + moodOf(todayMood.mood)[2] : 'Belum diisi, yuk pilih~'}</p>
          <div class="rr-moods mini">${MOODS.map(([k, e, n]) => `<button type="button" data-quickmood="${k}" title="${n}" aria-label="${n}"${todayMood?.mood === k ? ' class="on"' : ''}><span>${e}</span></button>`).join('')}</div></div>
        <div class="rr-card w-word"><h3>Kata hari ini</h3>
          <div class="wd-jp">${esc(w[0])}</div><div class="wd-rd">${esc(w[1])}</div><div class="wd-mn">${esc(w[2])}</div>
          <button type="button" class="rr-btn ghost sm" data-speak="${esc(w[1])}">🔊 Dengar</button></div>
        <div class="rr-card w-omi" data-go="omikuji" role="button" tabindex="0"><h3>Omikuji</h3>
          ${omiOpened() ? `<div class="omi-mini">${o.rank[0]}</div><p>${o.rank[1]} · ${o.rank[2]}</p>` : `<div class="omi-mini q">？</div><p>Ramalan hari ini belum dibuka. Ketuk untuk mengocok 🎋</p>`}</div>
        <div class="rr-card w-stats"><h3>Kenangan kita</h3>
          <div class="st"><button type="button" data-go="notes"><b>${d ? d.notes.length : '…'}</b><span>💌 surat</span></button><button type="button" data-go="dream"><b>${d ? `${done}/${dreams.length}` : '…'}</b><span>⭐ mimpi</span></button><button type="button" data-go="video"><b>${items.length || '…'}</b><span>🎞️ video</span></button></div></div>
        <div class="rr-card w-note"><h3>Surat terbaru</h3>
          ${latest ? `<div class="mini-note c-${esc(latest.color)}"><span class="stk">${esc(latest.sticker)}</span>${esc(latest.body)}</div>` : `<p>Belum ada surat. Jadi yang pertama nulis yuk ✍️</p>`}
          <button type="button" class="rr-btn ghost sm" data-go="notes">${latest ? 'Lihat semua →' : '✍️ Tulis surat'}</button></div>
        <div class="rr-card w-fun" data-go="fun" role="button" tabindex="0"><h3>Seru-seru 🎡</h3><div class="wf-ic" aria-hidden="true">🎡🎁🥠🫧</div><p>Roda kencan, kartu gosok, kue keberuntungan & bubble wrap nunggu kamu~</p></div>
        ${items.length ? `<div class="rr-card w-video"><h3>Video spesial</h3><p>${esc(items[0].name)}</p><button type="button" class="rr-btn pri sm" data-playfirst>▶ Putar sekarang</button></div>` : ''}
      </div>`;
  }
  function kangenLevel(n) {
    const lv = [[0, '🌱 baru mulai kangen'], [10, '🥺 lumayan kangen'], [50, '😭 kangen berat'], [150, '💘 kangen tingkat dewa'], [500, '🌌 kangen seluas galaksi']];
    return lv.filter(x => n >= x[0]).pop()[1];
  }
  let pendingKangen = 0, kangenTimer = 0;
  function sendKangen() {
    const n = Math.min(50, pendingKangen); if (!n) return;
    pendingKangen -= n;
    send('kangen', 'POST', { n }).then(j => { if (roomData) roomData.counters.kangen = j.value; }).catch(() => { pendingKangen += n; });
    if (pendingKangen) kangenTimer = setTimeout(sendKangen, 300);
  }
  function tapKangen(b) {
    pendingKangen++; burstAt(b, ['💗', '💖', '💕', '🥺', '💘'], 8);
    b.classList.remove('pump'); void b.offsetWidth; b.classList.add('pump');
    const total = (roomData?.counters?.kangen || 0) + pendingKangen;
    $('.kangen-n b', vt).textContent = total.toLocaleString('id-ID'); $('.kangen-lv', vt).textContent = kangenLevel(total);
    clearTimeout(kangenTimer); kangenTimer = setTimeout(sendKangen, 700);
  }

  function renderBoard() {
    const board = $('.rr-board', vt); if (!board) return;
    if (!roomData) { board.innerHTML = '<div class="rr-empty">Memuat surat… 💌</div>'; return; }
    if (!roomData.notes.length) { board.innerHTML = '<div class="rr-empty"><b>Papan masih kosong</b>Tulis surat pertama di atas, lalu tempel di sini 📌</div>'; return; }
    board.innerHTML = roomData.notes.map((n, i) => `<article class="rr-note c-${esc(n.color)}${n.pinned ? ' pinned' : ''}" style="--rot:${((n.id * 37) % 7) - 3}deg;--i:${i}" data-nid="${n.id}">
      <span class="stk">${esc(n.sticker)}</span>${n.pinned ? '<span class="pin" aria-label="Disematkan">📌</span>' : ''}
      <p>${esc(n.body)}</p>
      <footer><time>${fmtDate(n.createdAt)}</time><span><button type="button" data-x="note-pin" title="${n.pinned ? 'Lepas sematan' : 'Sematkan'}" aria-label="Sematkan">${n.pinned ? '📍' : '📌'}</button><button type="button" data-x="note-del" title="Hapus" aria-label="Hapus">🗑️</button></span></footer>
    </article>`).join('');
  }

  function renderMood() {
    const cal = $('.rr-cal', vt); if (!cal) return;
    const map = new Map((roomData?.moods || []).map(m => [m.day, m]));
    const today = map.get(dayKey());
    if (!selMood) { selMood = today?.mood || ''; $('.mood-note', vt).value = today?.note || ''; }
    $$('[data-mood]', vt).forEach(b => b.classList.toggle('on', b.dataset.mood === selMood));
    const days = [], now = new Date(); now.setHours(12);
    // 5 weeks, Monday first, ending with this week
    const first = new Date(now); first.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 28);
    for (let i = 0; i < 35; i++) { const d = new Date(first); d.setDate(first.getDate() + i); days.push(d); }
    cal.innerHTML = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(x => `<span class="dh">${x}</span>`).join('') + days.map(d => {
      const k = dayKey(d), m = map.get(k), fut = d > now;
      return `<span class="dc${k === dayKey() ? ' today' : ''}${fut ? ' fut' : ''}${m ? ' has m-' + m.mood : ''}" title="${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}${m ? ' · ' + moodOf(m.mood)[2] + (m.note ? ' — ' + esc(m.note) : '') : ''}">${m ? moodOf(m.mood)[1] : `<small>${d.getDate()}</small>`}</span>`;
    }).join('');
    const counts = {}; (roomData?.moods || []).forEach(m => { counts[m.mood] = (counts[m.mood] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    $('.rr-moodstat', vt).innerHTML = top ? `Paling sering: <b>${moodOf(top[0])[1]} ${moodOf(top[0])[2]}</b> (${top[1]}×) · total ${roomData.moods.length} hari tercatat` : 'Belum ada catatan mood. Mulai hari ini yuk 🌈';
  }
  async function saveMood(mood, note, from) {
    try {
      const j = await send('mood', 'PUT', { day: dayKey(), mood, note });
      if (roomData) { roomData.moods = [j.mood, ...roomData.moods.filter(m => m.day !== j.mood.day)]; }
      selMood = mood; if (from) burstAt(from, [moodOf(mood)[1], '✨', '💗'], 10);
      const rep = $('.rr-reply', vt); if (rep) rep.textContent = moodOf(mood)[3];
      toast(moodOf(mood)[1] + ' Mood tersimpan'); renderTab();
    } catch (e) { toast(e.message); }
  }

  function renderDreams() {
    const ul = $('.rr-dreams', vt); if (!ul) return;
    const list = roomData?.bucket || [], done = list.filter(x => x.done).length;
    $('.rr-prog i', vt).style.width = (list.length ? done / list.length * 100 : 0) + '%';
    $('.rr-prog span', vt).textContent = list.length ? `${done} dari ${list.length} mimpi terwujud ${done === list.length ? '🎉' : '✨'}` : 'Belum ada mimpi';
    if (!roomData) { ul.innerHTML = '<li class="rr-empty">Memuat… ⭐</li>'; return; }
    ul.innerHTML = list.length ? list.map(x => `<li class="rr-dream${x.done ? ' done' : ''}" data-did="${x.id}">
        <button type="button" class="ck" data-x="dream-toggle" aria-label="${x.done ? 'Tandai belum' : 'Tandai terwujud'}" aria-pressed="${x.done}">${x.done ? '✓' : ''}</button>
        <span class="em">${esc(x.emoji)}</span><span class="tx">${esc(x.text)}${x.done && x.doneAt ? `<small>terwujud ${new Date(x.doneAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</small>` : ''}</span>
        <button type="button" class="del" data-x="dream-del" aria-label="Hapus">✕</button></li>`).join('')
      : `<li class="rr-empty"><b>Ayo mulai bermimpi bareng</b>Ketuk ide di bawah untuk menambahkan:<div class="rr-ideas">${DREAM_IDEAS.map(([e, t]) => `<button type="button" data-idea="${esc(t)}" data-emo="${e}">${e} ${esc(t)}</button>`).join('')}</div></li>`;
  }
  async function addDream(text, emoji) {
    try { const j = await send('bucket', 'POST', { text, emoji }); roomData?.bucket.unshift(j.item); renderDreams(); toast('⭐ Mimpi ditambahkan'); }
    catch (e) { toast(e.message); }
  }

  function renderOmikuji(animate) {
    const paper = $('.omi-paper', vt); if (!paper) return;
    const opened = omiOpened(), o = omikuji();
    $('.rr-omi-stage', vt).classList.toggle('opened', opened);
    $('[data-x="omi"]', vt).textContent = opened ? '🌙 Kembali besok ya' : '🎋 Kocok omikuji';
    $('[data-x="omi"]', vt).disabled = opened;
    paper.hidden = !opened; if (!opened) return;
    paper.classList.toggle('reveal', !!animate);
    paper.innerHTML = `<div class="omi-rank"><span class="kj">${o.rank[0]}</span><div><b>${o.rank[1]}</b><small>${o.rank[2]}</small></div></div>
      <ul class="omi-lines">${o.lines.map(([k, t]) => `<li><b>${k}</b><span>${esc(t)}</span></li>`).join('')}</ul>
      <div class="omi-lucky">
        <div><small>Warna keberuntungan</small><b><i style="background:${o.color[1]}"></i>${o.color[0]}</b></div>
        <div><small>Benda keberuntungan</small><b>${o.item}</b></div>
        <div><small>Kata keberuntungan</small><b class="jp">${esc(o.word[0])}</b><span>${esc(o.word[1])} · ${esc(o.word[2])}</span></div>
      </div>
      <div class="omi-foot">🎋 ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Sakura Study Club</div>`;
  }
  function drawOmikuji() {
    if (omiOpened()) return;
    const stage = $('.rr-omi-stage', vt), b = $('[data-x="omi"]', vt);
    b.disabled = true; stage.classList.add('shaking');
    setTimeout(() => {
      stage.classList.remove('shaking'); localStorage.setItem('rr_omi', dayKey());
      renderOmikuji(true); const o = omikuji();
      if (o.rank[0] === '大吉') confetti(); burstAt($('.omi-box', vt), ['✨', '🎋', '🌸', '⭐'], 14);
      $('.omi-paper', vt).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }, reduced ? 50 : 1500);
  }

  /* ---------- 💝 Untukmu + 🎮 Main Yuk: little gifts and games, all from me to you ---------- */
  const REASONS = [
    'Senyummu bisa bikin hari burukku jadi baik lagi 🌤️', 'Kamu selalu dengerin ceritaku, sekecil apa pun itu 👂💗', 'Cara kamu ketawa itu lucu banget, sumpah 🤭',
    'Kamu tetap semangat belajar walaupun capek 📚', 'Kamu bikin aku pengen jadi orang yang lebih baik ✨', 'Pipimu kalau lagi ngambek… gemes 🐹',
    'Kamu perhatian sama hal-hal kecil 🌷', 'Suaramu tuh obat kangen paling manjur 📞', 'Kamu sabar banget ngadepin aku 🥹',
    'Kamu cantik, pagi, siang, malem, bangun tidur juga 😳', 'Kamu selalu inget hal-hal penting buat aku 🗓️', 'Kamu partner terbaik buat makan apa aja 🍜',
    'Kamu bikin hal biasa jadi seru 🎡', 'Pelukanmu itu tempat paling nyaman sedunia 🫂', 'Kamu jujur, dan aku suka itu 🤍',
    'Kamu punya mimpi besar, dan aku mau nemenin 🗻', 'Kamu lucu kalau lagi serius 🧐', 'Kamu selalu tau cara bikin aku tenang ☁️',
    'Kamu manis — lebih manis dari boba 🧋', 'Kamu kuat, lebih kuat dari yang kamu kira 💪', 'Tiap chat darimu bikin HP-ku jadi barang favorit 📱',
    'Kamu bisa jadi diri sendiri di depanku, dan itu berharga 🌸', 'Karena kamu ya kamu. Gak ada duanya 🦄', 'Kamu nerima aku apa adanya 🧸',
    'Matamu kalau lagi senyum ikut ketawa 👀✨', 'Kamu selalu nyemangatin aku 📣', 'Aku bisa diem berdua kamu tanpa canggung 🌙',
    'Kamu rajin belajar bahasa Jepang, keren! 🇯🇵', 'Kamu bikin masa depan kerasa seru 🔮', 'Kamu selalu jadi orang pertama yang mau aku kabarin 💌',
    'Kamu pinter, tapi gak sombong 🎓', 'Kamu baik sama semua orang 🌻', 'Kamu suka hal-hal lucu, sama kayak aku 🐰',
    'Kamu tuh rumah 🏡', 'Kamu bikin aku percaya cinta itu nyata 💞', 'Karena tiap hari aku jatuh cinta lagi sama kamu, terus, terus 💘',
  ];
  const OPEN_WHEN = [
    ['sedih', '🥺', 'Buka kalau lagi sedih', [
      'Sayang… gapapa kok sedih. Kamu gak harus kuat terus. Tarik napas pelan-pelan, peluk bantal, dan bayangin itu aku. Besok mataharinya terbit lagi, dan aku masih sayang kamu sama banyaknya. 🫂💗',
      'Laporan resmi dari Kementerian Pacar: hari ini kamu boleh nangis, boleh rebahan, boleh makan mie 2 bungkus. Semua sudah disetujui. Yang gak boleh cuma satu: ngerasa sendirian. Karena aku di sini. 📜🫡',
      'Sini, sini. Kepalanya taruh di pundakku dulu (pundak virtual, tapi empuk kok). Ceritain pelan-pelan, aku dengerin sampai habis tanpa motong. Janji. 🤍',
      'Fakta ilmiah: air mata itu cara hati buang sampah. Jadi nangis aja, nanti hatinya bersih lagi dan aku yang nempatin lagi. Hehe modus 🤭💧',
      'Kalau hari ini berat, ingat ya: kamu udah lewatin 100% hari-hari buruk sebelumnya. Rekor kamu sempurna! Aku bangga banget sama kamu. 🏆💗',
      'Aku kirim 1 truk pelukan, 3 karung cium, dan 1 kotak cokelat imajiner. Kurirnya aku sendiri. Tanda tangan di sini ya 👉 ✍️ 🚚💝',
      'Gapapa gak baik-baik aja. Kamu tetap cantik pas mata sembab, tetap lucu pas ingus meler (iya, serius). Aku sayang semua versi kamu. 🥹🌷',
      'Coba lihat ke luar jendela. Langit yang sama juga lagi aku lihat. Jadi secara teknis, kita lagi bareng sekarang. Senyum dikit dong? Dikiiit aja 🌤️',
    ]],
    ['kangen', '💭', 'Buka kalau lagi kangen', [
      'Kangen ya? Sama, aku juga. Coba pencet Tombol Kangen di Beranda sebanyak-banyaknya — tiap pencetan sampai ke aku. Jarak itu cuma angka, hatiku tetap nempel di kamu. 🥺💞',
      'Peringatan: tingkat kangen kamu sudah melewati batas aman. Segera lakukan tindakan darurat: chat aku sekarang, kirim foto selfie, dan bilang "aku kangen". Wajib. Gak pake malu. 🚨📱',
      'Tau gak, aku tuh juga lagi kangen tapi pura-pura cool. Sekarang ketahuan deh. Ya udah, kita kangen-kangenan aja bareng 😳💕',
      'Rumus kangen: (jarak × waktu) ÷ sabar = ketemu sebentar lagi. Aku udah ngitung, hasilnya positif. Tunggu aku ya 🧮💗',
      'Bayangin aku lagi nongol di depan pintu sambil bawa jajan kesukaanmu dan bilang "kejutaaan!". Nah, itu bakal kejadian beneran. Cuma belum sekarang aja 🚪🎁',
      'Kalau kangennya bisa dijual, kita berdua udah jadi miliarder. Sayangnya gak bisa, jadi kita tabung aja buat dipakai pas ketemu nanti 💰🥰',
      'Cium layar HP-mu sekarang. Udah? Nah, aku juga barusan. Jadi kita resmi ciuman jarak jauh. Romantis tapi agak berminyak layarnya 😆💋',
    ]],
    ['tidur', '🌙', 'Buka kalau gak bisa tidur', [
      'Belum ngantuk? Matiin layar sebentar ya. Bayangin kita lagi rebahan sambil dengerin hujan, aku elus-elus kepalamu sampai kamu ketiduran. Oyasumi, sayang. おやすみ 😴🌙',
      'Ayo hitung domba bareng: 🐑 1… 🐑 2… 🐑 3… eh domba ke-4 bawa tulisan "aku sayang kamu". Domba ke-5 juga. Semua dombanya ternyata dari aku 🐑💌',
      'Tips tidur ala aku: tarik napas 4 detik, tahan 7 detik, buang 8 detik. Kalau masih belum tidur, ulangi sambil mikirin aku. Kalau malah makin melek… ya maaf, aku emang semenarik itu 😌',
      'HP-nya taruh. Iya, sekarang. Aku tau kamu lagi scroll gak jelas. Matanya istirahat, besok cantiknya mau dipakai lagi 👀📵',
      'Dongeng singkat: Pada suatu hari ada seseorang yang paling lucu sedunia. Dia gak bisa tidur. Lalu pacarnya nulis surat ini. Dia tersenyum, menguap, dan tidur nyenyak. Tamat. Sekarang giliran kamu 📖💤',
      'Selimutnya ditarik sampai dagu, guling dipeluk erat (anggap aja itu aku, tapi jangan bilang guling ya nanti dia GR). Selamat bobo, cintaku 🛏️🧸',
    ]],
    ['capek', '📚', 'Buka kalau capek belajar', [
      'Hei, kamu udah hebat banget hari ini. Gapapa istirahat 10 menit, minum air, makan camilan. Kanji-kanji itu gak bakal kabur kok. Ganbatte ne! がんばってね 🍵✨',
      'Kanji 休 artinya istirahat — gambarnya orang (亻) nyender di pohon (木). Tuh, bahkan kanji aja nyuruh kamu istirahat. Masa kamu bantah kanji? 🌳😴',
      'Otakmu itu kayak HP: kalau baterainya 5% ya di-charge dulu. Charger-nya: cemilan, air putih, dan 1 chat dari aku. Udah aku kirim lewat surat ini 🔋📱',
      'Fun fact: tiap kamu belajar 1 kata Jepang, aku makin bangga 1 level. Sekarang aku udah level dewa bangganya. Kamu keren pol! 🇯🇵🏅',
      'Peraturan baru: setiap 25 menit belajar = 5 menit boleh mikirin aku. Kalau lebih dari 5 menit… ya gapapa sih, aku seneng 🍅⏱️',
      'Kalau capek, ingat tujuannya: nanti kita jalan-jalan ke Jepang dan kamu yang jadi translator. Aku cuma tukang bawain tas & fotoin kamu. Deal? ✈️🗾',
      'Sugoi! すごい! Kamu udah sejauh ini. Jangan bandingin sama orang lain, bandingin sama kamu yang kemarin. Dan kamu yang hari ini jauh lebih jago 📈💗',
    ]],
    ['marah', '😤', 'Buka kalau lagi marah sama aku', [
      'Maaf ya kalau aku bikin kesel… Kamu boleh marah, tapi jangan lama-lama ya 🥹 Ini kupon pelukan permintaan maaf: berlaku sekarang juga. Aku sayang kamu, bahkan pas kamu cemberut (justru makin gemes). 🙏💗',
      'Surat ini ditulis sambil berlutut (secara imajiner). Isinya: maaf, maaf, maaf, maaf, maaf. Kalau kurang, bilang aja, aku tambahin sampai satu halaman 🧎‍♂️📝',
      'Oke, aku salah. Pasti aku salah. Bahkan kalau belum tau salahnya apa, aku udah minta maaf duluan. Pacar yang proaktif ya kan? 😅🙏',
      'Muka cemberutmu sekarang: 😠. Muka aku sekarang: 🥺👉👈. Siapa yang menang? Ya kamu sih, kamu selalu menang. Maafin ya?',
      'Penawaran damai: 1 boba large + 1 pelukan 5 menit + kamu boleh cubit aku 3 kali. Gimana? Bisa nego, asal ujungnya baikan 🧋🤝',
      'Aku gak suka bikin kamu sedih atau kesel. Kalau mau ngomel, ngomel aja, aku dengerin. Habis itu kita baikan dan beli jajan bareng ya 💬🍡',
    ]],
    ['senang', '🎉', 'Buka kalau lagi bahagia', [
      'Yeay! Aku ikut seneng banget! Ceritain semuanya ke aku ya, detail sekecil apa pun. Senyummu hari ini simpan baik-baik — itu pemandangan favoritku. 🌈😊',
      'WOOHOO! 🎊 Kirim aku screenshot senyummu sekarang juga, mau aku jadiin wallpaper. Ini perintah resmi! 📸',
      'Kamu bahagia = aku bahagia. Itu udah hukum alam, kayak gravitasi. Jangan dibantah, Newton aja setuju 🍎😆',
      'Ayo joget dulu 10 detik! Gak ada yang lihat kok (kecuali aku dalam bayangan). Kiri, kanan, putar… nah gitu! 💃🕺',
      'Catat tanggal hari ini ya, biar kalau nanti lagi sedih kamu bisa ingat: "oh iya, pernah sebahagia itu". Dan pasti bakal ada lagi, lebih banyak 🗓️✨',
      'Senang itu menular. Makanya habis baca ini, kabarin aku ya biar aku ketularan juga 🦠💗 (virus yang baik kok)',
    ]],
    ['bosan', '🥱', 'Buka kalau lagi bosan', [
      'Misi rahasia buat kamu: cari 5 benda warna pink di sekitarmu, foto, kirim ke aku. Hadiahnya? Rahasia (tapi bentuknya cium) 🕵️‍♀️💗',
      'Daripada bosan, coba main game di tab Main. Kalau skornya tinggi, aku kasih gelar "Pacar Paling Jago Sedunia". Kalau skornya rendah… gelarnya tetap sama sih 😆🎮',
      'Tantangan: kirim aku chat cuma pakai emoji, aku tebak maksudnya. Kalau aku salah, aku traktir. Kalau benar, kamu traktir. Kalau seri, kita berdua jajan 🤔🍢',
      'Bosan itu tanda otakmu minta hal baru. Coba belajar 3 kanji baru, terus pamerin ke aku. Aku bakal pura-pura gak ngerti biar kamu bisa jelasin panjang lebar 🤓',
      'Ide random: rekam voice note nyanyi lagu favoritmu, kirim ke aku. Gak usah bagus, yang penting suara kamu. Aku dengerin berkali-kali 🎤🎶',
      'Tulis 3 hal yang kamu suka dari diri sendiri. Gak bisa? Sini aku bantu: 1) lucu, 2) pinter, 3) pacarnya ganteng. Sama-sama 😎',
    ]],
    ['lapar', '🍜', 'Buka kalau lagi laper', [
      'LAPAR?! Kode merah! Segera makan sekarang juga. Pacar yang laper bisa berubah jadi monster lucu, dan aku gak sanggup lawan 👹🍙',
      'Rekomendasi menu dari chef aku: mie instan + telur + cinta secukupnya. Rasanya 10/10, dijamin bikin kangen (sama aku) 🍳🍜',
      'Jangan lupa makan ya. Kamu boleh diet dari apa aja, kecuali dari perhatianku. Itu gak ada kalorinya kok 🥗💗',
      'Kalau aku di sana, aku udah pesenin makanan kesukaanmu dan suapin kamu. "Aaa~" Tapi karena lagi jauh, kamu suapin sendiri dulu ya, bayangin aku yang suapin 🥄😋',
      'Pertanyaan penting: kamu laper beneran atau laper pengen ngemil? Jawabannya gak penting, yang penting makan. Terus kirim foto makanannya ke aku 📸🍰',
      'Itadakimasu! いただきます! Ucapin itu sebelum makan, biar makanannya makin enak dan kamu makin jago bahasa Jepang. Dua burung satu batu 🍱',
    ]],
    ['overthinking', '🌀', 'Buka kalau lagi overthinking', [
      'Stop dulu. Otakmu lagi bikin film horor dari hal kecil ya? Aku sutradaranya bilang: CUT! Ceritanya gak gitu kok. Semuanya bakal baik-baik aja 🎬✋',
      'Tarik napas. Tanya ke diri sendiri: "ini masalah 5 tahun lagi masih penting gak?" Kalau enggak, kasih waktu 5 menit aja buat dipikirin. Sisanya buat mikirin aku 🧠💭',
      'Kalau kamu overthinking soal aku: tenang, aku masih sayang, masih setia, masih ganteng (oke yang ini subjektif). Gak ada yang berubah 💗🔒',
      'Pikiranmu itu kayak tab browser yang kebuka 47. Ayo tutup satu-satu. Yang tab "aku sayang kamu" jangan ditutup ya, itu penting 🗂️😆',
      'Coba tulis semua yang ganggu pikiranmu di kertas, terus lipat jadi pesawat dan terbangin. Kalau gak ada kertas, ceritain ke aku aja. Aku tempat sampah curhat terbaik 🛩️',
      'Kamu gak harus punya jawaban buat semuanya sekarang. Pelan-pelan aja. Kita pikirin bareng. Dua kepala lebih baik dari satu, apalagi kalau salah satunya kepala kamu yang pinter 🤝',
    ]],
    ['insecure', '🪞', 'Buka kalau lagi insecure', [
      'Coba lihat cermin. Itu orang yang aku pilih dari 8 miliar manusia di bumi. Seleraku bagus banget kan? Jadi jangan ragu sama dirimu 🌍💗',
      'Kamu tau gak kenapa bintang bersinar? Karena gak peduli lagi sama lampu jalan di sebelahnya. Jadilah bintang. Kamu udah bersinar kok di mataku ✨⭐',
      'Daftar kekurangan kamu menurut aku: 1) terlalu lucu, 2) terlalu bikin kangen, 3) … udah, itu aja. Parah kan? 📝😌',
      'Orang lain mungkin punya kelebihan yang beda, tapi gak ada yang punya senyum kamu, ketawa kamu, cara kamu ngomel. Itu limited edition, cuma 1 di dunia 🦄',
      'Kalau kamu gak bisa lihat betapa berharganya kamu, pinjem mataku sebentar. Dari sini kamu kelihatan luar biasa 👀💖',
      'Hari ini tugasmu satu: bilang "aku cukup" ke diri sendiri 3 kali. Kalau malu, bisik aja. Aku bakal teriakin buat kamu: KAMU LEBIH DARI CUKUP! 📣',
    ]],
    ['pagi', '☀️', 'Buka kalau baru bangun', [
      'Ohayou, sayang! おはよう! Selamat pagi buat orang yang pertama aku pikirin tiap bangun tidur ☀️😊',
      'Bangun, bangun! Matahari udah nunggu, tapi aku lebih nunggu. Minum air putih dulu ya, terus senyum. Wajib senyum. 🌅💧',
      'Muka bantal kamu pasti lucu banget sekarang. Sayang aku gak bisa lihat. Selfie dong? Gak usah dandan, aku suka yang natural 📸🥰',
      'Ramalan cuaca hari ini: 100% kemungkinan ada orang yang sayang kamu. Bawa payung cinta ya, soalnya bakal hujan perhatian dari aku ☂️💗',
      'Hari baru, kesempatan baru buat jadi luar biasa. Tapi kalau hari ini cuma mau jadi biasa aja, juga gapapa. Kamu tetap favoritku 🌻',
      'Checklist pagi: ☐ bangun ☐ cuci muka ☐ sarapan ☐ ingat aku sayang kamu. Yang terakhir udah aku centang duluan ✅',
    ]],
    ['hujan', '🌧️', 'Buka kalau lagi hujan', [
      'Hujan-hujan gini enaknya peluk-pelukan sambil minum cokelat panas. Kamu bikin cokelatnya, aku bawa pelukannya. Pembagian tugas yang adil ☕🫂',
      'Tiap tetes hujan yang jatuh itu satu "aku sayang kamu" dari aku. Coba hitung. Gak bakal habis kan? Sama kayak sayangku 🌧️💙',
      'Jangan hujan-hujanan ya, nanti masuk angin. Kalau udah terlanjur basah, cepat mandi air hangat. Ini bukan saran, ini perintah pacar 😤☔',
      'Suara hujan + selimut + lagu galau = kombinasi mematikan. Tapi tenang, kamu gak perlu galau, pacarmu ada dan masih sayang 🎧🌂',
      'Kalau nanti kita jalan dan hujan, aku rela payungnya buat kamu semua. Aku basah gapapa, yang penting kamu kering dan aku kelihatan keren ala drama Korea 😎🌦️',
    ]],
    ['ulangtahun', '🎂', 'Buka kalau hari ulang tahunmu', [
      'Selamat ulang tahun, sayangku! 🎉 Satu tahun lagi kamu makin cantik, makin pinter, dan makin bikin aku jatuh cinta. Semoga semua doamu terkabul, termasuk yang tentang aku 😉🎂',
      'Otanjoubi omedetou! お誕生日おめでとう! Hari ini kamu ratu. Semua permintaanmu (yang wajar) bakal aku turutin. Mulai dari mana, Yang Mulia? 👑',
      'Umurmu nambah, tapi tenang, imutnya gak berkurang sama sekali. Aku udah cek pakai kalkulator 🧮🥰',
      'Make a wish dulu, tiup lilinnya… fuuuh! 🕯️ Nah, salah satu wish-mu udah terkabul dari dulu: punya pacar kayak aku. Hehe 😝',
      'Terima kasih udah lahir ke dunia. Serius. Dunia jadi tempat yang jauh lebih seru sejak ada kamu 🌍🎁',
    ]],
    ['jenuh', '🫠', 'Buka kalau lagi pengen nyerah', [
      'Jangan nyerah ya. Kalau capek, istirahat. Kalau mau nangis, nangis. Tapi habis itu bangun lagi, karena kamu lebih kuat dari yang kamu kira, dan aku selalu di belakangmu 💪💗',
      'Ingat gak kenapa kamu mulai? Pegang alasan itu erat-erat. Kalau lupa, aku bantu ingetin, sampai kamu muak dengernya 😆📌',
      'Bambu butuh 5 tahun buat numbuhin akar sebelum tumbuh tinggi banget dalam 6 minggu. Kamu lagi di fase akar. Sabar ya, nanti meledak tingginya 🎋',
      'Nanakorobi yaoki — 七転び八起き — jatuh 7 kali, bangun 8 kali. Kamu boleh jatuh, asal bangunnya sama aku 🤝🇯🇵',
      'Kamu udah jauh banget dari titik awal. Lihat ke belakang sebentar, terus kasih tepuk tangan buat dirimu sendiri 👏👏 Aku juga tepuk tangan dari sini!',
    ]],
  ];
  const OW_SIGS = ['— dari aku, yang sayang kamu selalu 💗', '— pacarmu yang paling ganteng (gak terima protes) 😎', '— dari aku, kurir surat cinta pribadimu 📮', '— tertanda, fans nomor 1 kamu 📣', '— dari aku, yang lagi senyum-senyum sendiri nulis ini 🤭', '— peluk jauh, dari aku 🫂', '— yang selalu milih kamu, tiap hari 💞'];
  const OW_PS = ['P.S. Kamu lucu.', 'P.S. Jangan lupa minum air putih 💧', 'P.S. Aku kangen (lagi).', 'P.S. Surat ini sudah dicium sebelum dikirim 💋', 'P.S. Kalau baca ini sambil senyum, berarti berhasil 😁', 'P.S. Daisuki dayo! 大好きだよ', 'P.S. Coba buka lagi nanti, isinya bisa beda lho 👀', 'P.S. Ini rahasia kita berdua ya 🤫'];
  const OW_BTN = ['Peluk dulu, terus tutup 🫂', 'Simpan di hati 💗', 'Cium dulu baru tutup 😚', 'Makasih sayang 🥰', 'Hehe oke 🙈', 'Aku juga sayang kamu 💞'];
  const COUPONS = [
    ['peluk', '🫂', 'Pelukan 1 menit', 'Gak boleh dilepas sebelum 60 detik'], ['boba', '🧋', 'Traktir boba', 'Topping bebas, ukuran large'],
    ['maaf', '🕊️', 'Langsung dimaafkan', 'Berlaku untuk 1 kesalahan kecil'], ['jalan', '🎡', 'Jalan-jalan bebas', 'Kamu yang pilih tempatnya'],
    ['film', '🎬', 'Movie night', 'Kamu pilih film, aku nurut + popcorn'], ['pijat', '💆', 'Pijat pundak', '10 menit, no complain'],
    ['telpon', '📞', 'Telpon sampai ketiduran', 'Gak ada yang boleh tutup duluan'], ['foto', '📸', 'Photobox bareng', 'Pose lucu wajib'],
    ['masak', '🍳', 'Aku masakin', 'Menu request (semoga enak 😅)'], ['bebas', '🌟', 'Permintaan bebas', 'Apa aja, 1 kali (yang wajar ya 😆)'],
  ];
  const GOMBAL = [
    'Kamu tau gak bedanya kamu sama jam? Jam muter-muter, kalau kamu muter-muter di pikiranku 🕰️', 'Kamu pinter kanji ya? Pantes aku gak bisa baca perasaan selain sayang 🈴',
    'Kamu tuh kayak wifi. Deket kamu, aku langsung connect 📶', 'Aku gak butuh omikuji, kamu udah daikichi-ku 🎋', 'Gula itu manis, tapi kamu bikin diabetes hati 🍬',
    'Kamu capek gak? Dari tadi lari-lari di pikiranku terus 🏃‍♀️', 'Bahasa Jepangnya "aku sayang kamu" itu 大好き. Bahasa hatiku: kamu 💗',
    'Kalau kamu bintang, aku rela begadang tiap malam ⭐', 'Aku bukan fotografer, tapi aku bisa bayangin kita foto nikahan 📸💍',
    'Kamu tuh kayak mochi: lembut, manis, bikin nagih 🍡', 'Peta Indonesia luas, tapi alamat hatiku cuma satu: kamu 🗺️', 'Kamu tau kenapa langit biru? Karena merahnya dipake pipimu tiap aku gombalin 😳',
    'Aku rela jadi flashcard, asal kamu bolak-balik tiap hari 🃏', 'Hidupku kayak memory game. Begitu ketemu kamu: MATCH! 🧩', 'Kamu tuh login-nya, aku password-nya. Gak lengkap kalau gak bareng 🔐',
  ];
  const ASK_NO = ['Nggak 🙄', 'yakin? 🥺', 'masa sih?', 'pikir lagi deh', 'ih jahat 😢', 'gak bisa dipencet wlee 😛', 'coba lagi~', 'nope 🙅', 'salah tombol!', 'hehe 🤭'];
  const PET_LINES = ['Halo cantik! 🐰', 'Dia sayang banget sama kamu loh 🤫', 'Udah makan belum? 🍙', 'Pencet aku lagi dong~ 💗', 'Kamu wangi deh 🌸', 'Jangan lupa senyum ya 😊', 'Psst… cek tab Untukmu 💝', 'Coba tab Seru-seru deh 🎡', 'Aku disuruh jagain kamu 🛡️', 'Gemes banget sih kamu 🫠', 'Daisuki! 大好き 💕'];

  const getLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const owSeen = k => { const v = getLS('rr_owv', {})[k]; return Array.isArray(v) ? v : []; };
  const ctr = k => (roomData?.counters?.[k] || 0) + (pendingCount[k] || 0);
  const pendingCount = { peluk: 0, cium: 0 }; let countTimer = 0;
  function flushCounts() {
    Object.keys(pendingCount).forEach(key => {
      const n = Math.min(50, pendingCount[key]); if (!n) return;
      pendingCount[key] -= n;
      send('count', 'POST', { key, n }).then(j => { if (roomData) roomData.counters[key] = j.value; }).catch(() => { pendingCount[key] += n; });
    });
  }
  function bumpCount(key, el, chars) {
    pendingCount[key]++; burstAt(el, chars, 10);
    el.classList.remove('pump'); void el.offsetWidth; el.classList.add('pump');
    const out = $(`[data-lc="${key}"]`, vt); if (out) out.textContent = ctr(key).toLocaleString('id-ID');
    clearTimeout(countTimer); countTimer = setTimeout(flushCounts, 700);
  }

  /* days together */
  const sinceDate = () => { const v = String(roomData?.counters?.since || ''); return v.length === 8 ? new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)) : null; };
  const midnight = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addMonths = (d, n) => { const y = d.getFullYear(), m = d.getMonth() + n, last = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(d.getDate(), last)); };
  function together() {
    const s = sinceDate(); if (!s) return null;
    const today = midnight(), days = Math.round((today - s) / 864e5) + 1;
    let months = 0; while (addMonths(s, months + 1) <= today) months++;
    const rest = Math.round((today - addMonths(s, months)) / 864e5);
    const next = addMonths(s, months + 1), toNext = Math.round((next - today) / 864e5);
    const years = Math.floor(months / 12), nextAnniv = addMonths(s, (years + 1) * 12), toAnniv = Math.round((nextAnniv - today) / 864e5);
    return { s, days, months, rest, next, toNext, years, toAnniv, isMonthsary: rest === 0 && months > 0 };
  }
  const fmtLong = d => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  function renderGift() {
    const p = $('[data-panel="gift"]', vt); if (!p) return;
    const t = together(), opened = getLS('rr_reasons', []), lastReason = getLS('rr_reason_last', null);
    const used = id => roomData?.counters?.['coupon:' + id] || 0;
    p.innerHTML = `<div class="lv-days rr-card">
        ${t ? `<div class="lv-days-n"><small>kita udah bareng selama</small><b>${t.days.toLocaleString('id-ID')}</b><span>hari 💞</span></div>
          <div class="lv-days-tx"><p>${t.isMonthsary ? `🎉 <b>Happy ${t.months}${t.months % 12 === 0 ? ` bulan (${t.months / 12} tahun!)` : ' bulan'}, sayang!</b> Makasih udah bertahan sama aku 🥹` : `Sejak <b>${fmtLong(t.s)}</b> — ${t.years ? `${t.years} tahun ${t.months % 12} bulan` : `${t.months} bulan`} ${t.rest} hari penuh cinta.`}</p>
            <div class="lv-chips"><span>🗓️ ${t.toNext ? `${t.toNext} hari lagi` : 'hari ini'} ke ${t.months + 1} bulan</span><span>💍 ${t.toAnniv} hari lagi anniversary ke-${t.years + 1}</span><span>⏳ ${(t.days * 24).toLocaleString('id-ID')} jam bareng</span></div>
            <button type="button" class="rr-btn ghost sm" data-l="since-edit">✏️ Ubah tanggal</button></div>`
        : `<div class="lv-days-n"><small>hari bersama</small><b>?</b><span>💞</span></div><div class="lv-days-tx"><p><b>Kapan kita jadian?</b> Isi tanggalnya biar aku bisa ngitung tiap hari yang kita lewatin bareng.</p></div>`}
        <form class="lv-since"${t ? ' hidden' : ''}><input type="date" class="rr-input" max="${dayKey()}" value="${t ? dayKey(t.s) : ''}" aria-label="Tanggal jadian" required><button class="rr-btn pri">💾 Simpan</button></form>
      </div>
      <div class="rr-grid2">
        <div class="rr-card lv-jar-card"><h3>Toples alasan aku sayang kamu <small>${opened.length}/${REASONS.length} dibuka</small></h3>
          <p>Ketuk toplesnya, ambil satu gulungan kertas 🫙</p>
          <button type="button" class="lv-jar" data-l="jar" aria-label="Ambil alasan"><span class="lid"></span><span class="glass">${Array.from({ length: 14 }, (_, i) => { const r = Math.floor(i / 5), c = i % 5; return `<i style="--i:${i};left:${4 + c * 17 + (r % 2) * 8}%;bottom:${3 + r * 19}%;transform:rotate(${(i * 41) % 60 - 30}deg)">${['💗', '📜', '💌', '🌸', '💖'][i % 5]}</i>`; }).join('')}</span><span class="tag">love jar</span></button>
          <div class="lv-reason" aria-live="polite">${lastReason != null ? `<small>Alasan #${lastReason + 1}</small>${esc(REASONS[lastReason])}` : '<small>belum ada yang diambil</small>Ayo ambil yang pertama! 🥰'}</div></div>
        <div class="rr-card lv-hug"><h3>Peluk & cium virtual</h3><p>Tahan tombol peluk sampai penuh, atau ketuk cium sepuasnya 😚</p>
          <div class="lv-hug-row">
            <div><button type="button" class="lv-hold" data-l="hug" aria-label="Tahan untuk memeluk"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45"/><circle class="fill" cx="50" cy="50" r="45"/></svg><span>🫂</span></button>
              <div class="lv-ct"><b data-lc="peluk">${ctr('peluk').toLocaleString('id-ID')}</b> pelukan</div></div>
            <div><button type="button" class="lv-kiss" data-l="kiss" aria-label="Kirim cium">💋</button>
              <div class="lv-ct"><b data-lc="cium">${ctr('cium').toLocaleString('id-ID')}</b> ciuman</div></div>
          </div><p class="lv-hug-say" aria-live="polite"></p></div>
      </div>
      <h3 class="lv-h">💌 Surat "Buka kalau…"</h3>
      <p class="lv-env-hint">Tiap amplop isinya banyak & ganti-ganti tiap dibuka — buka lagi kapan aja ya 😉</p>
      <div class="lv-env">${OPEN_WHEN.map(([k, e, title, msgs]) => { const n = owSeen(k).length; return `<button type="button" class="lv-envelope${n ? ' read' : ''}" data-l="ow" data-k="${k}" data-rd="${n}/${msgs.length}"><span class="flap"></span><span class="em">${e}</span><b>${title}</b></button>`; }).join('')}</div>
      <h3 class="lv-h">🎟️ Kupon cinta <small>tukarkan kapan aja, nanti aku tepati 🤞</small></h3>
      <div class="lv-coupons">${COUPONS.map(([id, e, title, desc]) => { const u = used(id); return `<div class="lv-coupon${u ? ' used' : ''}" data-cid="${id}">
          <span class="em">${e}</span><div class="tx"><b>${title}</b><small>${desc}</small>${u ? `<em>ditukar ${new Date(u * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</em>` : ''}</div>
          <button type="button" class="rr-btn ${u ? 'ghost' : 'pri'} sm" data-l="coupon">${u ? '↺' : 'Tukar'}</button>${u ? '<span class="stamp">DITUKAR</span>' : ''}</div>`; }).join('')}</div>`;
    $('.lv-since', p).addEventListener('submit', async e => {
      e.preventDefault(); const day = $('.lv-since input', p).value; if (!day) return;
      try { const j = await send('since', 'PUT', { day }); if (roomData) roomData.counters.since = j.value; renderGift(); confetti(); toast('💞 Tanggal jadian tersimpan'); } catch (err) { toast(err.message); }
    });
    setupHug($('[data-l="hug"]', p));
  }

  function setupHug(b) {
    let raf = 0, start = 0;
    const fill = $('.fill', b), C = 2 * Math.PI * 45, HOLD = 1400;
    fill.style.strokeDasharray = C; fill.style.strokeDashoffset = C;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; b.classList.remove('holding'); fill.style.strokeDashoffset = C; };
    const tick = now => {
      const k = Math.min(1, (now - start) / HOLD); fill.style.strokeDashoffset = C * (1 - k);
      if (k < 1) { raf = requestAnimationFrame(tick); return; }
      stop(); bumpCount('peluk', b, ['🫂', '💗', '🤗', '💞']);
      const sayEl = $('.lv-hug-say', vt); if (sayEl) sayEl.textContent = pickR(Math.random, ['Pelukan diterima! Hangat banget 🥰', 'Nggak mau lepas ah 🫂', 'Peluuuk eraaat~ 💞', 'Rasanya kayak pulang ke rumah 🏡', 'Charging cinta: 100% 🔋']);
    };
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('holding'); start = performance.now(); raf = requestAnimationFrame(tick); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { if (raf) { stop(); const s = $('.lv-hug-say', vt); if (s) s.textContent = 'Tahan lebih lama dong, pelukannya kurang lama 🥺'; } }));
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bumpCount('peluk', b, ['🫂', '💗']); } });
  }

  function openLetter(k, prev) {
    const l = OPEN_WHEN.find(x => x[0] === k); if (!l) return;
    const msgs = l[3], all = getLS('rr_owv', {}); let seen = owSeen(k).filter(i => i < msgs.length);
    let pool = msgs.map((_, i) => i).filter(i => !seen.includes(i));
    if (!pool.length) { seen = []; pool = msgs.map((_, i) => i); }
    if (pool.length > 1 && prev != null) pool = pool.filter(i => i !== prev);
    const idx = pickR(Math.random, pool); seen.push(idx); all[k] = seen; setLS('rr_owv', all);
    const fresh = seen.length === msgs.length ? '<small class="ow-done">🎉 Semua surat di amplop ini udah kamu baca! Buka lagi, urutannya diacak ulang</small>' : '';
    const m = document.createElement('div'); m.className = 'lv-modal';
    m.innerHTML = `<div class="lv-letter" role="dialog" aria-modal="true" aria-label="${esc(l[2])}"><span class="seal">${l[1]}</span><h3>${esc(l[2])}</h3><small class="ow-no">surat #${idx + 1} dari ${msgs.length} · ${seen.length}/${msgs.length} udah dibaca</small><p>${esc(msgs[idx])}</p><p class="ow-ps">${esc(pickR(Math.random, OW_PS))}</p><div class="sig">${esc(pickR(Math.random, OW_SIGS))}</div>${fresh}<div class="ow-act"><button type="button" class="rr-btn ghost" data-ow="next">💌 Surat lain</button><button type="button" class="rr-btn pri" data-ow="close">${esc(pickR(Math.random, OW_BTN))}</button></div></div>`;
    vt.appendChild(m);
    const close = () => { m.remove(); renderGift(); };
    m.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b && b.dataset.ow === 'next') { m.remove(); openLetter(k, idx); return; }
      if (e.target === m || b) close();
    });
    $('[data-ow="close"]', m).focus(); burstAt($('.seal', m), ['💗', '✨', '💌'], 10);
  }

  /* 🎮 games */
  let askTries = 0, game = null;
  function renderPlay(force) {
    const p = $('[data-panel="play"]', vt); if (!p || (p.firstChild && !force)) return;
    if (game) endGame(true);
    askTries = 0;
    const best = getLS('rr_heart_best', 0), yes = getLS('rr_yes', 0);
    p.innerHTML = `<div class="rr-card lv-ask"><div class="lv-ask-bun" aria-hidden="true">🐰</div>
        <h3>Pertanyaan penting nih…</h3><p class="q">Kamu sayang aku gak? 🥺👉👈</p>
        <div class="lv-ask-area"><button type="button" class="rr-btn pri big lv-yes" data-l="yes">Iya 💗</button><button type="button" class="rr-btn ghost lv-no" data-l="no">Nggak 🙄</button></div>
        ${yes ? `<small class="lv-yes-n">Kamu udah jawab "iya" ${yes}× 🥰</small>` : ''}</div>
      <div class="rr-grid2">
        <div class="rr-card lv-calc"><h3>Kalkulator cinta 💘 <small>super akurat (katanya)</small></h3>
          <form class="lv-calc-f"><input class="rr-input" maxlength="20" placeholder="Nama kamu" aria-label="Nama kamu"><span>💞</span><input class="rr-input" maxlength="20" placeholder="Nama aku" aria-label="Nama aku"><button class="rr-btn pri wide">Hitung kecocokan</button></form>
          <div class="lv-calc-out" aria-live="polite"></div></div>
        <div class="rr-card lv-gacha"><h3>Gacha gombal 🎰 <small>siap-siap salting</small></h3>
          <button type="button" class="lv-machine" data-l="gacha" aria-label="Putar gacha"><span class="dome">${['💗', '💛', '💜', '💙', '💚', '🧡'].map((c, i) => { const [x, y] = [[14, 12], [39, 9], [64, 12], [26, 33], [52, 33], [39, 54]][i]; return `<i style="--i:${i};left:${x}%;bottom:${y}%">${c}</i>`; }).join('')}</span><span class="base">PUTAR</span></button>
          <div class="lv-gombal" aria-live="polite">Putar mesinnya buat dapet gombalan 😳</div></div>
      </div>
      <div class="rr-card lv-catch"><div class="lv-catch-hd"><div><h3>Tangkap hatiku! 💗</h3><p>Ketuk hati yang jatuh dalam 20 detik. 💖 = +3, 💔 = −2</p></div>
          <div class="lv-score"><span>Skor <b class="sc">0</b></span><span>⏱ <b class="tm">20</b></span><span>🏆 <b class="bs">${best}</b></span></div></div>
        <div class="lv-field"><div class="lv-field-msg"><b>Siap?</b><button type="button" class="rr-btn pri big" data-l="game">▶ Mulai</button></div></div></div>`;
    $('.lv-calc-f', p).addEventListener('submit', e => { e.preventDefault(); loveCalc(); });
    const no = $('.lv-no', p);
    no.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') dodge(no); });
  }
  function dodge(no) {
    askTries++;
    const area = $('.lv-ask-area', vt), yesB = $('.lv-yes', vt), r = area.getBoundingClientRect();
    no.classList.add('run');
    no.style.left = Math.random() * Math.max(0, r.width - no.offsetWidth) + 'px';
    no.style.top = Math.random() * Math.max(0, r.height - no.offsetHeight) + 'px';
    no.textContent = ASK_NO[askTries % ASK_NO.length];
    yesB.style.transform = `scale(${Math.min(1.9, 1 + askTries * .1)})`;
    if (askTries >= 8) { no.style.transform = `scale(${Math.max(.35, 1 - (askTries - 7) * .12)})`; }
    $('.lv-ask-bun', vt).textContent = askTries > 5 ? '😭' : askTries > 2 ? '🥺' : '🐰';
  }
  function sayYes(b) {
    setLS('rr_yes', getLS('rr_yes', 0) + 1);
    confetti(); burstAt(b, ['💗', '💖', '💕', '🥰', '💘'], 20);
    const card = $('.lv-ask', vt);
    card.innerHTML = `<div class="lv-ask-bun yay" aria-hidden="true">🥰</div><h3>Yeaaay! Aku tau kok 🥹</h3>
      <p class="q">Aku juga sayang kamu — lebih banyak dari jumlah kanji di dunia, lebih lama dari selamanya. 大好きだよ 💗</p>
      <button type="button" class="rr-btn ghost sm" data-l="ask-again">Tanya lagi dong 🙈</button>`;
  }
  function loveCalc() {
    const [a, b] = $$('.lv-calc-f input', vt).map(i => i.value.trim()), out = $('.lv-calc-out', vt);
    if (!a || !b) { out.innerHTML = '<p>Isi dua-duanya dulu ya 🥺</p>'; return; }
    const fake = 72 + Math.floor(seeded(a.toLowerCase() + '+' + b.toLowerCase())() * 22);
    out.innerHTML = `<div class="lv-meter"><i></i></div><div class="lv-pct">0%</div><p class="lv-calc-msg">menghitung… 🔮</p>`;
    const bar = $('.lv-meter i', out), pct = $('.lv-pct', out), msg = $('.lv-calc-msg', out);
    const run = (to, ms, done) => { const t0 = performance.now(), from = parseInt(pct.textContent) || 0; const f = now => { const k = Math.min(1, (now - t0) / ms), v = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); pct.textContent = v + '%'; bar.style.width = Math.min(100, v / (to > 100 ? 10 : 1)) + '%'; if (k < 1) requestAnimationFrame(f); else done?.(); }; requestAnimationFrame(f); };
    run(fake, reduced ? 1 : 1200, () => {
      msg.textContent = `${fake}%? …eh tunggu, alatnya error 😤`;
      setTimeout(() => {
        out.classList.add('fixed'); msg.innerHTML = `<b>${esc(a)} 💞 ${esc(b)}</b><br>Hasil sebenarnya: jodoh dunia akhirat. Sistem gak sanggup ngitung 🫠💍`;
        bar.style.width = '100%'; run(1000, reduced ? 1 : 900, () => { pct.textContent = '1000% 💯'; confetti(); });
      }, reduced ? 50 : 1300);
    });
  }
  function gacha(b) {
    const out = $('.lv-gombal', vt); b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); b.disabled = true;
    out.classList.remove('pop'); out.textContent = '…';
    setTimeout(() => { b.disabled = false; let i = getLS('rr_gombal', -1); i = (i + 1 + Math.floor(Math.random() * (GOMBAL.length - 1))) % GOMBAL.length; setLS('rr_gombal', i);
      out.textContent = GOMBAL[i]; void out.offsetWidth; out.classList.add('pop'); burstAt(out, ['😳', '💗', '✨'], 8); }, reduced ? 50 : 900);
  }
  function startGame() {
    const field = $('.lv-field', vt); if (!field || game) return;
    field.innerHTML = '';
    game = { score: 0, left: 20, field, hearts: new Set(), last: performance.now(), spawn: 0, raf: 0, end: performance.now() + 20000 };
    const sc = $('.lv-score .sc', vt), tm = $('.lv-score .tm', vt); sc.textContent = 0;
    const loop = now => {
      if (!game) return;
      const dt = Math.min(50, now - game.last); game.last = now; game.spawn -= dt;
      const h = field.clientHeight, left = Math.max(0, Math.ceil((game.end - now) / 1000)); tm.textContent = left;
      if (game.spawn <= 0) {
        game.spawn = 380 + Math.random() * 380 - Math.min(250, (20 - left) * 12);
        const roll = Math.random(), kind = roll < .12 ? ['💖', 3] : roll < .27 ? ['💔', -2] : ['💗', 1];
        const el = document.createElement('button'); el.type = 'button'; el.className = 'lv-fall'; el.textContent = kind[0];
        el.setAttribute('aria-label', kind[1] > 0 ? 'Tangkap hati' : 'Hati patah');
        const o = { el, y: -40, v: .09 + Math.random() * .08 + (20 - left) * .004, pts: kind[1] };
        el.style.left = Math.random() * (field.clientWidth - 44) + 'px';
        el.addEventListener('pointerdown', e => { e.preventDefault(); if (!game) return; game.score = Math.max(0, game.score + o.pts); sc.textContent = game.score; burst(e.clientX, e.clientY, o.pts > 0 ? ['💗', '✨'] : ['💔', '😵'], 6); el.remove(); game.hearts.delete(o); });
        field.appendChild(el); game.hearts.add(o);
      }
      game.hearts.forEach(o => { o.y += o.v * dt; o.el.style.transform = `translateY(${o.y}px)`; if (o.y > h) { o.el.remove(); game.hearts.delete(o); } });
      if (now >= game.end) return endGame();
      game.raf = requestAnimationFrame(loop);
    };
    game.raf = requestAnimationFrame(loop);
  }
  function endGame(silent) {
    if (!game) return; const g = game; game = null; cancelAnimationFrame(g.raf);
    g.hearts.forEach(o => o.el.remove()); if (silent) return;
    const best = getLS('rr_heart_best', 0), rec = g.score > best; if (rec) setLS('rr_heart_best', g.score);
    $('.lv-score .bs', vt).textContent = Math.max(best, g.score);
    const msg = g.score >= 40 ? 'Wah, kamu nangkep hatiku semua! Ya emang udah punya kamu sih 😳💗' : g.score >= 20 ? 'Jago banget! Hatiku aman di tanganmu 🥰' : g.score >= 8 ? 'Lumayan! Tapi tenang, hatiku tetap buat kamu kok 💕' : 'Gapapa, hatiku udah lama kamu tangkap 🤭';
    g.field.innerHTML = `<div class="lv-field-msg"><b>${g.score} poin${rec ? ' · rekor baru! 🏆' : ''}</b><p>${msg}</p><button type="button" class="rr-btn pri big" data-l="game">↻ Main lagi</button></div>`;
    if (rec && g.score > 0) confetti();
  }

  /* clicks for the two new tabs (data-l) */
  function loveClick(t) {
    const el = t.closest('[data-l]'); if (!el) return false;
    const l = el.dataset.l;
    if (l === 'jar') {
      const opened = getLS('rr_reasons', []); let pool = REASONS.map((_, i) => i).filter(i => !opened.includes(i));
      if (!pool.length) { setLS('rr_reasons', []); pool = REASONS.map((_, i) => i); toast('Semua alasan udah dibuka! Diulang dari awal ya — alasannya gak pernah habis 💗'); }
      const i = pickR(Math.random, pool), now = pool.length === REASONS.length ? [i] : [...opened, i];
      setLS('rr_reasons', now); setLS('rr_reason_last', i);
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      const box = $('.lv-reason', vt); box.innerHTML = `<small>Alasan #${i + 1}</small>${esc(REASONS[i])}`; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
      $('.lv-jar-card h3 small', vt).textContent = `${now.length}/${REASONS.length} dibuka`;
      burstAt(el, ['📜', '💗', '✨'], 8);
    } else if (l === 'kiss') bumpCount('cium', el, ['💋', '😘', '💗', '💕']);
    else if (l === 'ow') openLetter(el.dataset.k);
    else if (l === 'since-edit') { const f = $('.lv-since', vt); f.hidden = !f.hidden; if (!f.hidden) $('input', f).focus(); }
    else if (l === 'coupon') {
      const id = el.closest('[data-cid]').dataset.cid, was = !!roomData?.counters?.['coupon:' + id];
      if (was && !confirm('Kembalikan kupon ini jadi belum dipakai?')) return true;
      el.disabled = true;
      send('coupon', 'POST', { id, used: !was }).then(j => {
        if (roomData) roomData.counters[j.key] = j.value; renderGift();
        if (!was) { const c = $(`[data-cid="${id}"]`, vt); if (c) burstAt(c, ['🎟️', '💗', '✨'], 12); toast('🎟️ Kupon ditukar! Tunjukin ke aku ya, nanti aku tepati 🤞'); }
      }).catch(err => { el.disabled = false; toast(err.message); });
    }
    else if (l === 'yes') sayYes(el);
    else if (l === 'no') dodge(el);
    else if (l === 'ask-again') renderPlay(true);
    else if (l === 'gacha') gacha(el);
    else if (l === 'game') startGame();
    else if (l === 'pet') {
      const b = $('.lv-bubble', vt); b.textContent = pickR(Math.random, PET_LINES); b.hidden = false;
      el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); burstAt(el, ['💗', '✨', '🌸'], 6);
      clearTimeout(loveClick.pt); loveClick.pt = setTimeout(() => { b.hidden = true; }, 2600);
    }
    return true;
  }

  /* 🎡 Seru-seru: date wheel, scratch card, fortune cookie, talk cards, bubble wrap */
  const WHEEL = [['🍜', 'Makan ramen / bakso bareng'], ['🎬', 'Nonton film sambil video call'], ['🍦', 'Jajan es krim berdua'], ['📸', 'Photobox pose paling lucu'],
    ['🌇', 'Jalan sore lihat sunset'], ['🎮', 'Main game bareng'], ['🍳', 'Masak resep baru bareng'], ['📚', 'Belajar kanji bareng 10 menit']];
  const WHEEL_COL = ['#ffb3cf', '#d7c6ff', '#bfeccf', '#ffd2b8', '#bfe3ff', '#ffe59e', '#ffc4dd', '#cdeee0'];
  const SCRATCH = [['🫂', 'Pelukan 10 detik', 'tanpa boleh dilepas duluan'], ['🧋', 'Boba gratis', 'aku yang traktir, kamu yang pilih'], ['💆', 'Pijat pundak 5 menit', 'biar capeknya hilang'],
    ['🎤', 'Aku nyanyiin 1 lagu', 'lagu apa aja yang kamu mau'], ['📞', 'Telepon 30 menit', 'cerita apa aja, aku dengerin'], ['🍫', 'Cokelat kejutan', 'datang di hari yang gak terduga'],
    ['🌹', 'Satu bunga', 'buat orang paling cantik'], ['👑', 'Kamu bos seharian', 'aku nurut (hampir) semua permintaan'], ['🎬', 'Kamu pilih filmnya', 'aku gak boleh protes'], ['💌', 'Surat tulisan tangan', 'khusus buat kamu']];
  const FORTUNES = ['Hari ini ada yang senyum-senyum sendiri karena mikirin kamu 🤭', 'Keberuntunganmu: dapat pelukan ekstra minggu ini 🫂', 'Bintang bilang kamu makin gemes hari ini ✨',
    'Hal manis lagi jalan menuju kamu. Sabar ya 🍓', 'Kamu bakal ketawa keras hari ini. Siap-siap 😆', 'Seseorang bangga banget sama kamu (iya, aku) 🥹',
    'Semua usahamu bakal kebayar, pelan-pelan tapi pasti 🌱', 'Angka keberuntunganmu: 1, karena kamu satu-satunya 💗', 'Hari ini cocok buat makan enak tanpa rasa bersalah 🍰',
    'Ada pesan manis yang nunggu kamu di HP 📱', 'Kamu itu jawaban dari doa seseorang 🌙', 'Senyummu hari ini bisa nyembuhin bad mood orang lain 😊'];
  const TALK = {
    'Manis 🍓': ['Kapan pertama kali kamu ngerasa suka sama aku?', 'Hal kecil apa dari aku yang bikin kamu senyum?', 'Lagu apa yang paling mirip sama cerita kita?', 'Momen kita yang paling pengen kamu ulang?', 'Panggilan sayang apa yang paling kamu suka?'],
    'Lucu 🤭': ['Kalau aku jadi hewan, aku hewan apa?', 'Kebiasaan aku yang paling lucu menurutmu apa?', 'Kalau kita tukeran badan sehari, kamu mau ngapain?', 'Makanan apa yang paling cocok buat kencan kita?', 'Kalau kita punya kucing, namanya siapa?'],
    'Deep 🌙': ['Apa yang bikin kamu ngerasa paling disayang?', 'Hal apa yang pengen kamu ceritain tapi belum sempat?', 'Kamu paling butuh aku pas lagi gimana?', 'Apa satu hal yang pengen kamu pelajari tahun ini?', 'Gimana caraku bisa bikin harimu lebih ringan?'],
    'Masa depan ✨': ['Negara mana yang pengen kita kunjungi bareng?', 'Rumah impian kita kayak gimana?', 'Tradisi kecil apa yang mau kita bikin berdua?', '5 tahun lagi kamu pengen kita lagi ngapain?', 'Kencan impianmu kayak gimana?'],
  };
  const POP_LINES = ['Ada hati di dalamnya! 💗', 'Stres berkurang 10% 😌', 'Plop! Kamu hebat 🫧', 'Bonus: aku sayang kamu 💕', 'Gemes banget sih yang mecahin 🫠'];
  let wheelRot = 0, wheelBusy = false, talkCat = Object.keys(TALK)[0], talkIdx = -1, cookieLast = -1, scratchLast = -1, audioCtx = null;
  function renderFun(force) {
    const p = $('[data-panel="fun"]', vt); if (!p || (p.firstChild && !force)) return;
    const seg = 360 / WHEEL.length, pops = getLS('rr_pops', 0);
    p.innerHTML = `<div class="rr-grid2">
        <div class="rr-card fn-card"><h3>Roda kencan 🎡 <small>bingung mau ngapain? putar aja!</small></h3>
          <div class="fn-wheel-wrap"><span class="fn-pin" aria-hidden="true"></span>
            <div class="fn-wheel" style="background:conic-gradient(${WHEEL_COL.map((c, i) => `${c} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')});transform:rotate(${wheelRot}deg)">
              ${WHEEL.map(([e], i) => `<span style="transform:rotate(${i * seg + seg / 2}deg)"><b>${e}</b></span>`).join('')}</div>
            <button type="button" class="fn-hub" data-f="spin">PUTAR</button></div>
          <div class="fn-out" aria-live="polite">Ketuk <b>PUTAR</b> buat pilih kencan kita 💞</div></div>
        <div class="rr-card fn-card"><h3>Kartu gosok 🎁 <small>gosok pakai jari atau mouse</small></h3>
          <div class="fn-scratch"><div class="fn-prize"></div><canvas aria-label="Kartu gosok"></canvas></div>
          <button type="button" class="rr-btn ghost sm" data-f="scratch-new">🔄 Kartu baru</button></div>
      </div>
      <div class="rr-grid2">
        <div class="rr-card fn-card"><h3>Kue keberuntungan 🥠 <small>ketuk kuenya buat dibuka</small></h3>
          <button type="button" class="fn-cookie" data-f="cookie" aria-label="Buka kue keberuntungan"><span class="l">🥠</span></button>
          <div class="fn-fortune" aria-live="polite">Ada pesan kecil di dalam kue ini 🤫</div></div>
        <div class="rr-card fn-card fn-talk"><h3>Kartu ngobrol 💬 <small>bahan obrolan pas telponan</small></h3>
          <div class="fn-cats" role="group" aria-label="Kategori">${Object.keys(TALK).map(c => `<button type="button" data-f="talk-cat" data-c="${esc(c)}"${c === talkCat ? ' class="on"' : ''}>${esc(c)}</button>`).join('')}</div>
          <div class="fn-q" aria-live="polite"><small>${esc(talkCat)}</small><p>Pilih kategori, lalu ambil kartu pertama 🃏</p></div>
          <button type="button" class="rr-btn pri" data-f="talk-next">Ambil kartu →</button></div>
      </div>
      <div class="rr-card fn-wrap"><div class="fn-wrap-hd"><div><h3>Bubble wrap anti-galau 🫧</h3><p>Pecahin satu-satu, galaunya ikut pecah 😌</p></div><span class="fn-popn"><b>${pops.toLocaleString('id-ID')}</b> dipecahin</span></div>
        <div class="fn-bubbles">${Array.from({ length: 24 }, (_, i) => `<button type="button" class="fn-b" data-f="pop" aria-label="Pecahkan gelembung ${i + 1}"></button>`).join('')}</div>
        <p class="fn-say" aria-live="polite"></p></div>`;
    setupScratch();
  }
  function spinWheel() {
    if (wheelBusy) return; wheelBusy = true;
    const seg = 360 / WHEEL.length, i = Math.floor(Math.random() * WHEEL.length), c = i * seg + seg / 2 + (Math.random() - .5) * seg * .6;
    wheelRot += 360 * 5 + ((360 - c - wheelRot % 360) % 360 + 360) % 360;
    const w = $('.fn-wheel', vt), out = $('.fn-out', vt), hub = $('.fn-hub', vt);
    hub.disabled = true; out.textContent = 'Muter… muter… 🌀'; out.classList.remove('pop');
    w.style.transition = reduced ? 'none' : 'transform 3.6s cubic-bezier(.15,.7,.15,1)'; w.style.transform = `rotate(${wheelRot}deg)`;
    setTimeout(() => {
      wheelBusy = false; hub.disabled = false;
      out.innerHTML = `<small>kencan kita berikutnya:</small><b>${WHEEL[i][0]} ${esc(WHEEL[i][1])}</b>`; void out.offsetWidth; out.classList.add('pop');
      burstAt(out, ['💗', '✨', WHEEL[i][0]], 12);
    }, reduced ? 60 : 3700);
  }
  function setupScratch() {
    const box = $('.fn-scratch', vt); if (!box) return;
    let i; do { i = Math.floor(Math.random() * SCRATCH.length); } while (i === scratchLast && SCRATCH.length > 1); scratchLast = i;
    const [e, title, desc] = SCRATCH[i];
    $('.fn-prize', box).innerHTML = `<span>${e}</span><b>${esc(title)}</b><small>${esc(desc)}</small>`;
    const old = $('canvas', box), cv = old.cloneNode(); old.replaceWith(cv);
    const W = box.clientWidth || 300, H = box.clientHeight || 160, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#d9c4e8'); g.addColorStop(.5, '#f4d7e6'); g.addColorStop(1, '#c9d6f0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff55'; for (let k = 0; k < 40; k++) { ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 2.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#6a3b5c'; ctx.font = '900 18px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✨ GOSOK DI SINI ✨', W / 2, H / 2 - 8); ctx.font = '700 12px Nunito, sans-serif'; ctx.fillText('ada hadiah buat kamu', W / 2, H / 2 + 16);
    ctx.globalCompositeOperation = 'destination-out';
    let down = false, last = null, moves = 0, done = false;
    const pt = ev => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const draw = ([x, y]) => { ctx.lineWidth = 36; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...(last || [x, y])); ctx.lineTo(x, y); ctx.stroke(); last = [x, y]; };
    const check = () => {
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let clear = 0, n = 0;
      for (let k = 3; k < d.length; k += 4 * 40) { n++; if (d[k] < 40) clear++; }
      if (!done && clear / n > .5) { done = true; cv.classList.add('gone'); burstAt(box, ['🎁', '💗', '✨', e], 14); toast('🎁 Hadiah: ' + title + ' — tunjukin ke aku ya!'); }
    };
    cv.addEventListener('pointerdown', ev => { if (done) return; ev.preventDefault(); down = true; last = null; cv.setPointerCapture?.(ev.pointerId); draw(pt(ev)); });
    cv.addEventListener('pointermove', ev => { if (!down || done) return; draw(pt(ev)); if (++moves % 8 === 0) check(); });
    ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => { if (down) { down = false; check(); } }));
  }
  function crackCookie(b) {
    const out = $('.fn-fortune', vt); if (b.classList.contains('open')) { b.classList.remove('open'); out.textContent = 'Ketuk lagi buat kue baru 🥠'; return; }
    let i; do { i = Math.floor(Math.random() * FORTUNES.length); } while (i === cookieLast); cookieLast = i;
    b.classList.remove('crack'); void b.offsetWidth; b.classList.add('crack', 'open');
    setTimeout(() => { out.innerHTML = `<span class="slip">${esc(FORTUNES[i])}</span>`; out.classList.remove('pop'); void out.offsetWidth; out.classList.add('pop'); burstAt(b, ['✨', '🥠', '💗'], 8); }, reduced ? 0 : 420);
  }
  function nextTalk() {
    const qs = TALK[talkCat]; let i; do { i = Math.floor(Math.random() * qs.length); } while (i === talkIdx && qs.length > 1); talkIdx = i;
    const q = $('.fn-q', vt); q.innerHTML = `<small>${esc(talkCat)}</small><p>${esc(qs[i])}</p>`; q.classList.remove('flip'); void q.offsetWidth; q.classList.add('flip');
  }
  function popSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(700 + Math.random() * 300, t); o.frequency.exponentialRampToValueAtTime(120, t + .08);
      g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + .1); o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + .11);
    } catch { /* no audio, no problem */ }
  }
  function popBubble(b) {
    if (b.classList.contains('popped')) return;
    b.classList.add('popped'); popSound();
    const n = getLS('rr_pops', 0) + 1; setLS('rr_pops', n); $('.fn-popn b', vt).textContent = n.toLocaleString('id-ID');
    const say = $('.fn-say', vt);
    if (Math.random() < .18) { b.textContent = '💗'; say.textContent = pickR(Math.random, POP_LINES); burstAt(b, ['💗', '🫧'], 6); }
    if (!$$('.fn-b:not(.popped)', vt).length) {
      say.innerHTML = 'Semua udah pecah! Semoga hatimu udah lebih lega ya 🫶 <button type="button" class="rr-btn ghost sm" data-f="refill">🫧 Isi ulang</button>';
      confetti();
    }
  }
  function funClick(t) {
    const el = t.closest('[data-f]'); if (!el) return false;
    const f = el.dataset.f;
    if (f === 'spin') spinWheel();
    else if (f === 'scratch-new') setupScratch();
    else if (f === 'cookie') crackCookie(el);
    else if (f === 'talk-cat') { talkCat = el.dataset.c; talkIdx = -1; $$('[data-f="talk-cat"]', vt).forEach(b => b.classList.toggle('on', b === el)); nextTalk(); }
    else if (f === 'talk-next') nextTalk();
    else if (f === 'pop') popBubble(el);
    else if (f === 'refill') { $$('.fn-b', vt).forEach(b => { b.classList.remove('popped'); b.textContent = ''; }); $('.fn-say', vt).textContent = 'Gelembung baru siap dipecahin 🫧'; }
    return true;
  }

  /* ---------- videos ---------- */
  async function refresh() {
    if (!items.length) grid.innerHTML = '<div class="vt-empty"><b>Memuat…</b>sebentar ya 🎞️</div>';
    try {
      const j = await (await api('list')).json();
      items = j.items; chunkSize = j.chunk || chunkSize; renderGrid(); if (tab === 'home') renderHome();
    } catch (e) { if (token) grid.innerHTML = `<div class="vt-empty"><b>Gagal memuat</b>${esc(e.message)}</div>`; }
  }
  function renderGrid() {
    const total = items.reduce((a, b) => a + b.size, 0);
    sum.textContent = items.length ? `${items.length} video · ${fmtSize(total)}` : '';
    if (!items.length) { grid.innerHTML = '<div class="vt-empty"><b>Belum ada video</b>Video motion yang dibuat untuk web ini akan muncul di sini dengan sendirinya 🎬</div>'; return; }
    grid.innerHTML = items.map(it => `<article class="vt-card" data-id="${it.id}">
      <button type="button" class="vt-thumb" data-c="play" aria-label="Putar ${esc(it.name)}">${cache.has(it.id) ? `<video src="${cache.get(it.id)}#t=0.5" muted playsinline preload="metadata"></video>` : thumbs.get(it.id) ? `<img src="${thumbs.get(it.id)}" alt="" loading="lazy">` : ''}<span class="vt-play">▶</span>${it.builtin ? '<span class="vt-badge">✨ spesial</span>' : ''}</button>
      <div class="vt-meta"><div class="nm">${esc(it.name)}</div>${it.desc ? `<div class="ds">${esc(it.desc)}</div>` : ''}<div class="sub">${fmtSize(it.size)} · ${fmtDate(it.created)}</div></div>
      <div class="vt-act"><button type="button" class="vt-btn pri" data-c="dl">⬇ Unduh</button>${it.builtin ? '' : '<button type="button" class="vt-btn" data-c="ren" title="Ganti nama" aria-label="Ganti nama">✎</button><button type="button" class="vt-btn" data-c="del" title="Hapus" aria-label="Hapus">🗑</button>'}</div>
    </article>`).join('');
    items.filter(it => it.hasThumb && !thumbs.has(it.id) && !cache.has(it.id)).forEach(it => {
      thumbs.set(it.id, '');
      api('thumb?id=' + it.id).then(r => r.blob()).then(b => { thumbs.set(it.id, URL.createObjectURL(b)); renderGrid(); }).catch(() => thumbs.delete(it.id));
    });
  }

  /* ---------- one click handler for the whole room ---------- */
  vt.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-go][role="button"]')) { e.preventDefault(); e.target.click(); } });
  vt.addEventListener('click', async e => {
    const t = e.target;
    const v = t.closest('[data-v]')?.dataset.v;
    if (v === 'close') return closeVault();
    if (v === 'out') return logout();
    const tb = t.closest('[data-tab]'); if (tb) return switchTab(tb.dataset.tab);
    const go = t.closest('[data-go]'); if (go) return switchTab(go.dataset.go);
    const th = t.closest('.rr-themes [data-theme]');
    if (th) { vt.dataset.theme = th.dataset.theme; localStorage.setItem('rr_theme', th.dataset.theme); burstAt(th, ['✨', '🎨'], 6); return; }
    const sp = t.closest('[data-speak]'); if (sp) return speak(sp.dataset.speak);
    if (t.closest('[data-playfirst]')) return items[0] && play(items[0]);
    const qm = t.closest('[data-quickmood]'); if (qm) return saveMood(qm.dataset.quickmood, roomData?.moods.find(m => m.day === dayKey())?.note || '', qm);
    const md = t.closest('[data-mood]');
    if (md) { selMood = md.dataset.mood; $$('[data-mood]', vt).forEach(b => b.classList.toggle('on', b === md)); $('.rr-reply', vt).textContent = moodOf(selMood)[3]; return; }
    const nc = t.closest('[data-ncolor]');
    if (nc) { noteColor = nc.dataset.ncolor; $$('[data-ncolor]', vt).forEach(b => b.classList.toggle('on', b === nc)); $('.rr-paper', vt).dataset.color = noteColor; return; }
    const ns = t.closest('[data-nstk]');
    if (ns) { noteSticker = ns.dataset.nstk; $$('[data-nstk]', vt).forEach(b => b.classList.toggle('on', b === ns)); $('.rr-paper .stk', vt).textContent = noteSticker; return; }
    const idea = t.closest('[data-idea]'); if (idea) return addDream(idea.dataset.idea, idea.dataset.emo);
    if (loveClick(t) || funClick(t)) return;

    const x = t.closest('[data-x]')?.dataset.x;
    if (x) {
      if (x === 'kangen') return tapKangen(t.closest('[data-x]'));
      if (x === 'omi') return drawOmikuji();
      if (x === 'idea') {
        const ta = $('[data-panel="notes"] textarea', vt);
        ta.value = pickR(Math.random, NOTE_IDEAS); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.dispatchEvent(new Event('input')); return;
      }
      if (x === 'note-add') {
        const ta = $('[data-panel="notes"] textarea', vt), body = ta.value.trim(), b = t.closest('[data-x]');
        if (!body) { toast('Suratnya masih kosong ✍️'); ta.focus(); return; }
        b.disabled = true;
        try {
          const j = await send('notes', 'POST', { body, color: noteColor, sticker: noteSticker });
          roomData?.notes.splice(roomData.notes.filter(n => n.pinned).length, 0, j.note);
          ta.value = ''; ta.dispatchEvent(new Event('input')); renderBoard(); burstAt(b, ['💌', '💗', '✨'], 10); toast('📌 Surat ditempel!');
        } catch (err) { toast(err.message); } finally { b.disabled = false; }
        return;
      }
      if (x === 'note-pin' || x === 'note-del') {
        const id = Number(t.closest('[data-nid]').dataset.nid);
        if (x === 'note-del' && !confirm('Hapus surat ini?')) return;
        try {
          if (x === 'note-del') { await api('notes?id=' + id, { method: 'DELETE' }); roomData.notes = roomData.notes.filter(n => n.id !== id); }
          else { const j = await send('notes/pin?id=' + id, 'POST'); roomData.notes = roomData.notes.map(n => n.id === id ? j.note : n).sort((a, b) => (b.pinned - a.pinned) || (new Date(b.createdAt) - new Date(a.createdAt))); }
          renderBoard();
        } catch (err) { toast(err.message); }
        return;
      }
      if (x === 'mood-save') {
        if (!selMood) return toast('Pilih mood dulu ya 🌈');
        return saveMood(selMood, $('.mood-note', vt).value.trim(), t.closest('[data-x]'));
      }
      if (x === 'dream-emo') { dreamEmo = DREAM_EMO[(DREAM_EMO.indexOf(dreamEmo) + 1) % DREAM_EMO.length]; t.closest('[data-x]').textContent = dreamEmo; return; }
      if (x === 'dream-toggle' || x === 'dream-del') {
        const li = t.closest('[data-did]'), id = Number(li.dataset.did);
        try {
          if (x === 'dream-del') { if (!confirm('Hapus mimpi ini?')) return; await api('bucket?id=' + id, { method: 'DELETE' }); roomData.bucket = roomData.bucket.filter(d => d.id !== id); }
          else {
            const j = await send('bucket/toggle?id=' + id, 'POST'); roomData.bucket = roomData.bucket.map(d => d.id === id ? j.item : d);
            if (j.item.done) { confetti(); toast('🎉 Yeay! Satu mimpi terwujud'); }
          }
          renderDreams();
        } catch (err) { toast(err.message); }
        return;
      }
    }

    const c = t.closest('[data-c]'); if (!c) return;
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
    try { const url = await load(it); playing = it; setRate(1); pv.src = url; player.hidden = false; pv.play().catch(() => {}); renderGrid(); }
    catch (e) { toast(e.message || 'Gagal memutar'); }
  }

  // re-validate a stored session quietly
  if (token) api('check').catch(() => {});
})();
