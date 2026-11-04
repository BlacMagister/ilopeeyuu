/* ============ Tangkap Mochi 🍡 — falling-kana reading game ============
 * Mochi with a hiragana/katakana letter fall from the sky. The lowest mochi is
 * the target; pick its romaji (buttons or keys 1–4) before it lands.
 * A landed mochi costs a heart and shows its reading, so every miss teaches.
 */
(() => {
  const $ = id => document.getElementById(id);
  const root = $('mochi-root'); if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ROMA = 'a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho ma mi mu me mo ya yu yo ra ri ru re ro wa wo n'.split(' ');
  const HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
  const KATA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
  const SETS = {
    hira: { name: 'Hiragana', sample: 'あ', list: ROMA.map((r, i) => ({ k: HIRA[i], r })) },
    kata: { name: 'Katakana', sample: 'ア', list: ROMA.map((r, i) => ({ k: KATA[i], r })) },
  };
  SETS.mix = { name: 'Campur', sample: 'あア', list: [...SETS.hira.list, ...SETS.kata.list] };
  const COLORS = ['#ffd6e7', '#e3f7df', '#fff1c9', '#e8e0ff', '#ffe2cf'];

  root.innerHTML = `
    <div class="mo-hud">
      <div class="mo-stat"><span>Skor</span><b id="mo-score">0</b></div>
      <div class="mo-stat"><span>Level</span><b id="mo-level">1</b></div>
      <div class="mo-stat"><span>Nyawa</span><b id="mo-lives" class="mo-hearts">❤️❤️❤️</b></div>
      <div class="mo-stat"><span>Rekor</span><b id="mo-best">0</b></div>
    </div>
    <div class="mo-field" id="mo-field">
      <div class="mo-clouds" aria-hidden="true"><i>☁️</i><i>☁️</i><i>☁️</i></div>
      <div class="mo-layer" id="mo-layer" aria-hidden="true"></div>
      <div class="mo-combo" id="mo-combo" aria-live="polite"></div>
      <div class="mo-ground" aria-hidden="true"><div class="mo-usagi" id="mo-usagi"></div><span class="mo-bowl">🥣</span></div>
      <div class="mo-overlay" id="mo-start">
        <div class="mo-card">
          <span class="mo-big">🍡</span>
          <h4>Tangkap Mochi!</h4>
          <p>Mochi berhuruf kana berjatuhan. Pilih <b>romaji</b> untuk mochi yang <b>bercahaya</b> sebelum jatuh ke tanah. Jangan sampai 3 mochi jatuh ya~</p>
          <div class="mo-sets" role="radiogroup" aria-label="Pilih huruf">
            ${Object.entries(SETS).map(([id, s]) => `<button type="button" role="radio" data-set="${id}"><b class="font-jp">${s.sample}</b><small>${s.name}</small></button>`).join('')}
          </div>
          <button type="button" class="mo-go" id="mo-go">Mulai ▶</button>
          <small class="mo-keys">💻 di laptop: tekan 1–4 · ⎵ spasi untuk jeda</small>
        </div>
      </div>
      <div class="mo-overlay" id="mo-pause" hidden>
        <div class="mo-card"><span class="mo-big">⏸️</span><h4>Jeda dulu~</h4><p>Mochinya nungguin kamu kok 🍡</p>
          <div class="mo-row"><button type="button" class="mo-go" id="mo-resume">Lanjut ▶</button><button type="button" class="mo-ghost" id="mo-quit">Berhenti</button></div></div>
      </div>
      <div class="mo-overlay" id="mo-over" hidden>
        <div class="mo-card">
          <span class="mo-big" id="mo-o-emo">🎉</span>
          <h4 id="mo-o-title">Selesai!</h4>
          <span class="mo-record" id="mo-o-record" hidden>🏆 Rekor baru!</span>
          <div class="mo-res"><div><span>Skor</span><b id="mo-o-score">0</b></div><div><span>Ketangkap</span><b id="mo-o-caught">0</b></div><div><span>Akurasi</span><b id="mo-o-acc">0%</b></div></div>
          <p class="mo-earn" id="mo-o-earn"></p>
          <div class="mo-miss" id="mo-o-miss"></div>
          <div class="mo-row"><button type="button" class="mo-go" id="mo-again">Main lagi 🔁</button><button type="button" class="mo-ghost" onclick="switchMode('pet')">Suapin Usagi 🥕</button></div>
          <button type="button" class="mo-link" id="mo-change">Ganti huruf</button>
        </div>
      </div>
    </div>
    <div class="mo-answers" id="mo-answers">${[0, 1, 2, 3].map(i => `<button type="button" data-i="${i}" disabled><kbd>${i + 1}</kbd><span>–</span></button>`).join('')}</div>
    <button type="button" class="mo-pausebtn" id="mo-pausebtn" hidden>⏸️ Jeda</button>`;

  const field = $('mo-field'), layer = $('mo-layer'), answers = [...$('mo-answers').children];
  const el = id => $('mo-' + id);
  let setId = 'hira';
  try { if (SETS[localStorage.getItem('mochi-set')]) setId = localStorage.getItem('mochi-set'); } catch (_) {}
  const bestOf = id => { try { return +localStorage.getItem('mochi-best-' + id) || 0; } catch (_) { return 0; } };

  function markSet() {
    root.querySelectorAll('[data-set]').forEach(b => { const on = b.dataset.set === setId; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    el('best').textContent = bestOf(setId);
  }
  root.querySelector('.mo-sets').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    setId = b.dataset.set; try { localStorage.setItem('mochi-set', setId); } catch (_) {} markSet();
  });
  markSet();
  const dressUsagi = () => { if (window.UsagiPet) el('usagi').innerHTML = UsagiPet.svg(UsagiPet.wearClasses()); };
  dressUsagi();

  /* ---------- game state ---------- */
  let G = null, raf = 0, lastT = 0, target = null, mochiId = 0;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function start() {
    G = { score: 0, caught: 0, tries: 0, lives: 3, level: 1, combo: 0, mochi: [], spawnIn: 0.4, missed: new Map(), running: true, paused: false, recent: [] };
    layer.innerHTML = '';
    el('start').hidden = true; el('over').hidden = true; el('pause').hidden = true; el('pausebtn').hidden = false;
    dressUsagi(); hud(); setTarget(null);
    fit(); scrollToGame();
    lastT = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }

  /* ---------- fit the whole game (HUD → ground → answers) inside the visible screen ---------- */
  const headerH = () => { const h = document.querySelector('header'); return h && getComputedStyle(h).position !== 'static' ? h.getBoundingClientRect().height : 0; };
  const navH = () => { const n = $('nav-tabs'); if (!n || getComputedStyle(n).position !== 'fixed') return 0; return Math.max(0, innerHeight - n.getBoundingClientRect().top); };
  function fit() {
    if (!root.offsetParent) return;
    const vh = window.visualViewport ? visualViewport.height : innerHeight;
    const hud = root.querySelector('.mo-hud').offsetHeight + 10;
    const ans = $('mo-answers').offsetHeight + 12;
    const pauseBtn = 46;
    const h = Math.round(vh - headerH() - navH() - hud - ans - pauseBtn - 18);
    field.style.height = Math.max(230, Math.min(520, h)) + 'px';
  }
  function scrollToGame() {
    if (!root.offsetParent) return;
    const top = root.getBoundingClientRect().top + scrollY - headerH() - 8;
    scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  }
  let fitT;
  const refit = () => { clearTimeout(fitT); fitT = setTimeout(fit, 120); };
  addEventListener('resize', refit);
  addEventListener('orientationchange', refit);
  if (window.visualViewport) visualViewport.addEventListener('resize', refit);
  // fall speed scales with the field height so the time-to-land feels the same on every screen
  const speed = () => (34 + G.level * 9) * Math.max(0.6, field.clientHeight / 440); // px per second
  const spawnGap = () => Math.max(1.05, 2.9 - G.level * 0.22); // seconds between mochi
  const maxOnField = () => Math.min(4, 1 + Math.ceil(G.level / 2));
  const groundY = () => field.clientHeight - 78;

  function spawn() {
    const pool = SETS[setId].list;
    let item, guard = 0;
    do { item = pool[Math.floor(Math.random() * pool.length)]; } while ((G.recent.includes(item.k) || G.mochi.some(m => m.r === item.r)) && ++guard < 30);
    G.recent.push(item.k); if (G.recent.length > 8) G.recent.shift();
    const d = document.createElement('div');
    d.className = 'mo-mochi';
    d.style.setProperty('--c', COLORS[Math.floor(Math.random() * COLORS.length)]);
    d.style.left = (12 + Math.random() * 76) + '%';
    d.innerHTML = `<span class="font-jp">${item.k}</span><i></i>`;
    layer.appendChild(d);
    G.mochi.push({ id: ++mochiId, k: item.k, r: item.r, y: -70, el: d, wob: Math.random() * 6 });
  }

  function loop(t) {
    if (!G || !G.running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (!G.paused) {
      G.spawnIn -= dt;
      if (G.spawnIn <= 0 && G.mochi.length < maxOnField()) { spawn(); G.spawnIn = spawnGap(); }
      const gy = groundY(), v = speed();
      for (const m of [...G.mochi]) {
        m.y += v * dt; m.wob += dt * 3;
        m.el.style.transform = `translate(-50%, ${m.y.toFixed(1)}px) rotate(${(Math.sin(m.wob) * 6).toFixed(1)}deg)`;
        if (m.y >= gy) land(m);
      }
      const low = G.mochi.reduce((a, m) => (!a || m.y > a.y ? m : a), null);
      if (low !== target) setTarget(low);
    }
    if (G.running) raf = requestAnimationFrame(loop);
  }

  function setTarget(m) {
    if (target) target.el.classList.remove('is-target');
    target = m;
    if (!m) { answers.forEach(b => { b.disabled = true; b.querySelector('span').textContent = '–'; }); return; }
    m.el.classList.add('is-target');
    // distractors: prefer readings that share a vowel or consonant, so they are worth thinking about
    const others = ROMA.filter(r => r !== m.r);
    const similar = shuffle(others.filter(r => r.slice(-1) === m.r.slice(-1) || r[0] === m.r[0]));
    const opts = [m.r];
    for (const r of [...similar.slice(0, 2), ...shuffle(others)]) { if (opts.length >= 4) break; if (!opts.includes(r)) opts.push(r); }
    shuffle(opts).forEach((r, i) => { const b = answers[i]; b.disabled = false; b.dataset.r = r; b.classList.remove('wrong', 'right'); b.querySelector('span').textContent = r; });
  }

  function remove(m) { G.mochi = G.mochi.filter(x => x !== m); if (target === m) target = null; }

  function answer(i) {
    if (!G || !G.running || G.paused || !target) return;
    const b = answers[i]; if (!b || b.disabled) return;
    G.tries++;
    const m = target;
    if (b.dataset.r === m.r) {
      G.caught++; G.combo++;
      const pts = 1 + (G.combo >= 5 ? 1 : 0) + (G.combo >= 10 ? 1 : 0);
      G.score += pts;
      b.classList.add('right'); setTimeout(() => b.classList.remove('right'), 250);
      remove(m);
      m.el.classList.remove('is-target'); m.el.classList.add('caught');
      m.el.style.left = '50%';
      m.el.style.transform = `translate(-50%, ${groundY() + 20}px) scale(.25)`;
      setTimeout(() => m.el.remove(), 450);
      const u = el('usagi'); u.classList.remove('yum'); void u.offsetWidth; u.classList.add('yum');
      floatText(`+${pts}`, m);
      if (G.combo >= 3) showCombo(`Combo x${G.combo} 🔥`);
      if (G.caught % 8 === 0) { G.level++; showCombo(`Level ${G.level}! はやい!`, true); }
      window.UsagiPet && UsagiPet.study('mochi');
      setTarget(null);
    } else {
      G.combo = 0;
      G.missed.set(m.k, m.r);
      b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); b.disabled = true;
      m.el.classList.remove('shake'); void m.el.offsetWidth; m.el.classList.add('shake');
    }
    hud();
  }

  function land(m) {
    remove(m);
    G.combo = 0; G.lives--; G.missed.set(m.k, m.r);
    m.el.classList.remove('is-target'); m.el.classList.add('splat');
    m.el.innerHTML = `<span class="font-jp">${m.k}</span><em>${m.r}</em>`;
    setTimeout(() => m.el.remove(), 1300);
    field.classList.remove('hurt'); void field.offsetWidth; field.classList.add('hurt');
    showCombo(`べちゃ! ${m.k} = ${m.r}`, false, true);
    setTarget(null); hud();
    if (G.lives <= 0) setTimeout(end, 500);
  }

  function floatText(txt, m) {
    const s = document.createElement('span'); s.className = 'mo-float'; s.textContent = txt;
    s.style.left = m.el.style.left; s.style.top = Math.max(10, m.y) + 'px';
    layer.appendChild(s); setTimeout(() => s.remove(), 800);
  }
  let comboT;
  function showCombo(txt, big, bad) {
    const c = el('combo'); c.textContent = txt; c.className = 'mo-combo show' + (big ? ' big' : '') + (bad ? ' bad' : '');
    clearTimeout(comboT); comboT = setTimeout(() => c.classList.remove('show'), 1100);
  }
  function hud() {
    el('score').textContent = G.score; el('level').textContent = G.level;
    el('lives').textContent = '❤️'.repeat(Math.max(0, G.lives)) + '🤍'.repeat(3 - Math.max(0, G.lives));
  }

  function end() {
    if (!G) return;
    G.running = false; cancelAnimationFrame(raf);
    G.mochi.forEach(m => m.el.remove()); G.mochi = []; setTarget(null);
    el('pausebtn').hidden = true;
    const best = bestOf(setId), rec = G.score > best;
    if (rec) { try { localStorage.setItem('mochi-best-' + setId, String(G.score)); } catch (_) {} }
    el('best').textContent = Math.max(best, G.score);
    const acc = G.tries ? Math.round(G.caught / G.tries * 100) : 0;
    el('o-score').textContent = G.score; el('o-caught').textContent = G.caught; el('o-acc').textContent = acc + '%';
    el('o-record').hidden = !rec;
    el('o-emo').textContent = G.score >= 40 ? '🏆' : G.score >= 15 ? '🎉' : '🍡';
    el('o-title').textContent = G.score >= 40 ? 'すごい! Jago banget!' : G.score >= 15 ? 'じょうず! Keren!' : 'がんばった! Bagus, lanjut lagi yuk~';
    el('o-earn').innerHTML = G.caught ? `Usagi dapat <b>${G.caught / 2 % 1 ? (G.caught / 2).toFixed(1) : G.caught / 2} poin belajar</b> dari mochi yang kamu tangkap 🥕` : 'Tangkap mochi biar Usagi dapat wortel 🥕';
    const miss = [...G.missed];
    el('o-miss').innerHTML = miss.length
      ? `<h5>📝 Huruf yang perlu dilatih</h5><div>${miss.slice(0, 16).map(([k, r]) => `<span><b class="font-jp">${k}</b>${r}</span>`).join('')}</div>`
      : (G.caught ? '<h5>💮 Tanpa salah sama sekali! Sempurna~</h5>' : '');
    el('over').hidden = false;
    if (rec && G.score > 0 && !reduce) burst();
  }
  function burst() {
    const colors = ['#ff8fb8', '#ffd35c', '#9be3b0', '#b9a6ff', '#ffb38a'];
    for (let i = 0; i < 40; i++) {
      const c = document.createElement('div'); c.className = 'confetti';
      c.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % 5]};--dx:${(Math.random() * 160 - 80).toFixed(0)}px;animation-delay:${(Math.random() * .4).toFixed(2)}s`;
      document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
    }
  }

  function pause(on) {
    if (!G || !G.running) return;
    G.paused = on; el('pause').hidden = !on;
    if (!on) lastT = performance.now();
  }

  /* ---------- wiring ---------- */
  answers.forEach((b, i) => b.addEventListener('pointerdown', e => { e.preventDefault(); answer(i); }));
  answers.forEach((b, i) => b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); answer(i); } }));
  el('go').addEventListener('click', start);
  el('again').addEventListener('click', start);
  el('change').addEventListener('click', () => { el('over').hidden = true; el('start').hidden = false; });
  el('resume').addEventListener('click', () => pause(false));
  el('quit').addEventListener('click', () => { el('pause').hidden = true; end(); });
  el('pausebtn').addEventListener('click', () => pause(true));
  let active = false;
  addEventListener('keydown', e => {
    if (!active || !G || !G.running || e.target.closest('input,textarea,select')) return;
    if (e.key >= '1' && e.key <= '4') { e.preventDefault(); answer(+e.key - 1); }
    else if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); pause(!G.paused); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

  window.Mochi = {
    show() { active = true; dressUsagi(); markSet(); requestAnimationFrame(fit); },
    hide() { active = false; pause(true); },
  };
})();
