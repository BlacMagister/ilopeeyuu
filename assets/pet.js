/* ============ Usagi Peliharaan — a study-powered Tamagotchi 🐰🥕 ============
 * Studying anywhere on the site earns study points → carrots. Carrots feed
 * Usagi; feeding gives XP → levels → new outfits. Usagi gets hungry over time.
 * Everything is saved on this device (localStorage), like the other study games.
 */
(() => {
  const KEY = 'usagi-pet-v1';
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const POINTS_PER_CARROT = 5;
  const FEED_FULL = 20;           // +20% fullness per carrot
  const FEED_XP = 10;
  const DECAY_PER_HOUR = 100 / 30; // full → empty in ~30 hours
  const xpFor = lv => 25 * lv * (lv - 1); // total XP needed to reach level lv

  const ITEMS = [
    { id: 'bow', slot: 'ear', lv: 1, ic: '🎀', name: 'Pita pink' },
    { id: 'flower', slot: 'head', lv: 2, ic: '🌸', name: 'Bunga sakura' },
    { id: 'scarf', slot: 'body', lv: 3, ic: '🧣', name: 'Syal hangat' },
    { id: 'glasses', slot: 'face', lv: 4, ic: '👓', name: 'Kacamata bulat' },
    { id: 'crown', slot: 'head', lv: 5, ic: '👑', name: 'Mahkota' },
    { id: 'kimono', slot: 'body', lv: 6, ic: '👘', name: 'Kimono' },
    { id: 'cap', slot: 'head', lv: 7, ic: '🎓', name: 'Topi wisuda' },
  ];

  const MISSIONS = [
    { id: 'flash', ic: '🃏', name: 'Balik 5 flashcard', goal: 5, go: 'flashcard' },
    { id: 'memory', ic: '🧩', name: 'Menang 1x Memory Match', goal: 1, go: 'memory' },
    { id: 'kanji', ic: '漢', name: 'Tandai 5 kanji "Hafal"', goal: 5, go: 'kanji' },
    { id: 'mochi', ic: '🍡', name: 'Tangkap 15 mochi', goal: 15, go: 'mochi' },
  ];
  const MISSION_REWARD = 2, ALL_BONUS = 3;

  const SAY = {
    pet: [['だいすき！', 'daisuki!', 'sayang banget!'], ['うれしい！', 'ureshii!', 'aku senang!'], ['くすぐったい～', 'kusuguttai~', 'geli~'],
      ['なでなで', 'nade-nade', 'elus-elus'], ['かわいい？', 'kawaii?', 'aku imut nggak?'], ['いっしょにべんきょうしよう', 'issho ni benkyou shiyou', 'ayo belajar bareng'],
      ['がんばってね！', 'ganbatte ne!', 'semangat ya!'], ['ありがとう', 'arigatou', 'terima kasih'], ['たのしい！', 'tanoshii!', 'seru!'], ['えらいね！', 'erai ne!', 'pinter deh kamu!'],
      ['もっと！', 'motto!', 'lagi dong!'], ['しあわせ～', 'shiawase~', 'bahagia~']],
    hungry: [['おなかすいた…', 'onaka suita…', 'aku lapar…'], ['にんじんちょうだい', 'ninjin choudai', 'minta wortel dong'], ['ぺこぺこ…', 'peko-peko…', 'perutku keroncongan…']],
    feed: [['おいしい！', 'oishii!', 'enak!'], ['もぐもぐ', 'mogu-mogu', 'nyam nyam'], ['ごちそうさま！', 'gochisousama!', 'makasih makanannya!'], ['にんじん だいすき', 'ninjin daisuki', 'aku suka wortel']],
    full: [['おなかいっぱい', 'onaka ippai', 'udah kenyang banget']],
    empty: [['にんじんがない…', 'ninjin ga nai…', 'wortelnya habis…']],
    sleep: [['ねむい…', 'nemui…', 'ngantuk…'], ['おやすみ', 'oyasumi', 'selamat tidur'], ['ぐうぐう', 'guu-guu', 'zzz…']],
    level: [['やったー！', 'yattaa!', 'horee!']],
    hello: [['おかえり！', 'okaeri!', 'selamat datang lagi!'], ['こんにちは！', 'konnichiwa!', 'halo!']],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  /* ---------- state ---------- */
  const fresh = () => ({ carrots: 3, full: 60, last: Date.now(), xp: 0, points: 0, fed: 0,
    wear: { ear: 'bow', head: null, face: null, body: null }, day: today(), mis: {}, done: {}, bonus: false, seen: [] });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  function tick() {
    const now = Date.now();
    S.full = Math.max(0, S.full - (now - S.last) / 36e5 * DECAY_PER_HOUR);
    S.last = now;
    if (S.day !== today()) { S.day = today(); S.mis = {}; S.done = {}; S.bonus = false; S.seen = []; }
  }
  const level = () => { let lv = 1; while (S.xp >= xpFor(lv + 1)) lv++; return lv; };
  const isNight = () => { const h = new Date().getHours(); return h >= 22 || h < 6; };
  let wokenUntil = 0;
  function mood() {
    if (isNight() && Date.now() > wokenUntil) return 'sleep';
    if (S.full >= 70) return 'happy';
    if (S.full >= 35) return 'ok';
    if (S.full >= 10) return 'hungry';
    return 'starving';
  }
  const MOOD_TXT = { sleep: '😴 Lagi bobo', happy: '🥰 Bahagia', ok: '🙂 Biasa aja', hungry: '🥺 Lapar', starving: '😭 Lapar banget!' };

  /* ---------- SVG (shared with Tangkap Mochi) ---------- */
  let uid = 0;
  function svg(cls = '') {
    const c = 'ptclip' + (++uid);
    return `<svg class="pt-svg ${cls}" viewBox="-6 -10 112 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><clipPath id="${c}"><ellipse cx="50" cy="93" rx="27" ry="15"/></clipPath></defs>
      <g class="pt-ear l"><ellipse cx="36" cy="24" rx="10" ry="24" fill="#fff" stroke="#f3bcd3" stroke-width="2"/><ellipse cx="36" cy="26" rx="5" ry="16" fill="#ffc8de"/></g>
      <g class="pt-ear r"><ellipse cx="64" cy="24" rx="10" ry="24" fill="#fff" stroke="#f3bcd3" stroke-width="2"/><ellipse cx="64" cy="26" rx="5" ry="16" fill="#ffc8de"/></g>
      <g class="acc acc-bow"><path d="M60 10 l8 -6 l2 9 z M60 10 l-9 -4 l3 9 z" fill="#e75b94"/><circle cx="60" cy="10" r="3" fill="#c63e79"/></g>
      <ellipse cx="24" cy="88" rx="7" ry="10" fill="#fff" stroke="#f3bcd3" stroke-width="2"/>
      <ellipse cx="76" cy="88" rx="7" ry="10" fill="#fff" stroke="#f3bcd3" stroke-width="2"/>
      <ellipse cx="50" cy="93" rx="27" ry="15" fill="#fff" stroke="#f3bcd3" stroke-width="2"/>
      <g class="acc acc-kimono" clip-path="url(#${c})"><rect x="20" y="76" width="60" height="34" fill="#ff9cc4"/><circle cx="32" cy="104" r="2.4" fill="#fff" opacity=".8"/><circle cx="68" cy="102" r="2.4" fill="#fff" opacity=".8"/><circle cx="58" cy="106" r="1.8" fill="#fff" opacity=".8"/><rect x="20" y="98" width="60" height="5" fill="#b8356f"/></g>
      <circle cx="50" cy="66" r="30" fill="#fff" stroke="#f3bcd3" stroke-width="2"/>
      <g class="acc acc-kimono"><path d="M43 95 L50 102 L57 95" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/></g>
      <g class="e-open"><ellipse class="pt-eye" cx="39" cy="64" rx="3.8" ry="4.8" fill="#53364e"/><ellipse class="pt-eye" cx="61" cy="64" rx="3.8" ry="4.8" fill="#53364e"/><circle cx="40.3" cy="62.2" r="1.3" fill="#fff"/><circle cx="62.3" cy="62.2" r="1.3" fill="#fff"/></g>
      <path class="e-happy" d="M34 65 q5 -6 10 0 M56 65 q5 -6 10 0" stroke="#53364e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path class="e-sleep" d="M34 63 q5 5 10 0 M56 63 q5 5 10 0" stroke="#53364e" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path class="e-sad" d="M33 56 l9 -3 M67 56 l-9 -3" stroke="#53364e" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse class="pt-blush" cx="30" cy="74" rx="6" ry="3.5" fill="#ff9bc3" opacity=".6"/>
      <ellipse class="pt-blush" cx="70" cy="74" rx="6" ry="3.5" fill="#ff9bc3" opacity=".6"/>
      <path d="M48 69 l2 2 l2 -2 z" fill="#f476a8"/>
      <path class="m-smile" d="M46 72 q4 4 8 0" stroke="#c63e79" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path class="m-sad" d="M46 76 q4 -4 8 0" stroke="#c63e79" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse class="m-o" cx="50" cy="75" rx="3.6" ry="3.2" fill="#c63e79"/>
      <path class="pt-tear" d="M33 70 q-3 5 0 7 q3 -2 0 -7z" fill="#8fd3ff"/>
      <g class="acc acc-scarf"><path d="M24 86 Q50 100 76 86 L76 93 Q50 107 24 93 Z" fill="#ff7aa8" stroke="#e0578c" stroke-width="1"/><rect x="60" y="94" width="8" height="15" rx="3" fill="#ff7aa8" stroke="#e0578c" stroke-width="1"/></g>
      <g class="acc acc-glasses" fill="none" stroke="#7a4b35" stroke-width="2"><circle cx="39" cy="64" r="8" fill="#fff" fill-opacity=".25"/><circle cx="61" cy="64" r="8" fill="#fff" fill-opacity=".25"/><path d="M47 63 q3 -3 6 0"/></g>
      <g class="acc acc-flower" transform="translate(27 43)"><g fill="#ffb6d2" stroke="#ef7fab" stroke-width=".8"><circle cx="0" cy="-5" r="4"/><circle cx="4.8" cy="-1.5" r="4"/><circle cx="3" cy="4" r="4"/><circle cx="-3" cy="4" r="4"/><circle cx="-4.8" cy="-1.5" r="4"/></g><circle r="2.4" fill="#ffd35c"/></g>
      <g class="acc acc-crown"><path d="M35 42 L36 26 L43 34 L50 22 L57 34 L64 26 L65 42 Z" fill="#ffd35c" stroke="#d9a52b" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="35" r="2.5" fill="#ff5c9a"/></g>
      <g class="acc acc-cap"><rect x="35" y="33" width="30" height="9" rx="2" fill="#3b2f46"/><path d="M50 22 L80 31 L50 40 L20 31 Z" fill="#4b3c59" stroke="#2c2235" stroke-width="1"/><path d="M50 31 L72 34 L72 46" stroke="#ffd35c" stroke-width="1.6" fill="none"/><circle cx="72" cy="47" r="2.4" fill="#ffd35c"/></g>
      <ellipse cx="36" cy="106" rx="9" ry="5" fill="#fff" stroke="#f3bcd3" stroke-width="2"/>
      <ellipse cx="64" cy="106" rx="9" ry="5" fill="#fff" stroke="#f3bcd3" stroke-width="2"/>
    </svg>`;
  }
  const wearClasses = () => Object.values(S.wear).filter(Boolean).map(id => 'w-' + id).join(' ');

  /* ---------- toast ---------- */
  let toastEl, toastT;
  function toast(html) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pt-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = html; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ---------- study hook (called by the other modes) ---------- */
  function study(type, key) {
    tick();
    if (key) { const k = type + ':' + key; if (S.seen.includes(k)) return; S.seen.push(k); if (S.seen.length > 400) S.seen.shift(); }
    const gain = type === 'memory' ? 5 : type === 'mochi' ? 0.5 : 1;
    const before = Math.floor(S.points / POINTS_PER_CARROT);
    S.points += gain;
    const got = Math.floor(S.points / POINTS_PER_CARROT) - before;
    let msg = '';
    if (got > 0) { S.carrots += got; msg = `+${got} 🥕 dari belajar!`; }
    const m = MISSIONS.find(x => x.id === type);
    if (m && !S.done[m.id]) {
      S.mis[m.id] = (S.mis[m.id] || 0) + 1;
      if (S.mis[m.id] >= m.goal) {
        S.done[m.id] = true; S.carrots += MISSION_REWARD;
        msg = `🎯 Misi selesai: ${m.name}! <b>+${MISSION_REWARD} 🥕</b>`;
        if (!S.bonus && MISSIONS.every(x => S.done[x.id])) { S.bonus = true; S.carrots += ALL_BONUS; msg = `🏆 Semua misi hari ini beres! <b>+${MISSION_REWARD + ALL_BONUS} 🥕</b>`; }
      }
    }
    save(); renderBadge();
    if (visible) render();
    const mission = /^(🎯|🏆)/u.test(msg);
    // During Tangkap Mochi only mission toasts are shown, so the game isn't covered by popups.
    if (msg && (type !== 'mochi' || mission)) toast(mission ? msg : msg + ' <small>Usagi nunggu disuapin 🐰</small>');
  }

  /* ---------- UI ---------- */
  let visible = false, built = false, bubbleT;
  const els = {};
  function build() {
    if (built) return; built = true;
    const root = $('pet-root'); if (!root) return;
    root.innerHTML = `
      <div class="pt-grid">
        <div class="pt-room-card">
          <div class="pt-top">
            <div><b class="pt-name">Usagi-chan</b><span class="pt-lv" id="pt-lv">Lv 1</span></div>
            <span class="pt-mood" id="pt-mood"></span>
          </div>
          <div class="pt-room" id="pt-room">
            <div class="pt-window" aria-hidden="true"><span class="pt-sun">☀️</span><span class="pt-moon">🌙</span><i>🌸</i></div>
            <div class="pt-shelf" aria-hidden="true">📚 🪴 🍵</div>
            <div class="pt-bubble" id="pt-bubble" role="status" aria-live="polite"></div>
            <div class="pt-zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></div>
            <button type="button" class="pt-pet" id="pt-pet" aria-label="Elus Usagi"></button>
            <div class="pt-fx" id="pt-fx" aria-hidden="true"></div>
            <div class="pt-rug" aria-hidden="true"></div>
          </div>
          <div class="pt-bars">
            <div class="pt-bar"><span>🥕 Kenyang</span><div class="pt-track"><i id="pt-full"></i></div><b id="pt-full-t">0%</b></div>
            <div class="pt-bar"><span>💖 XP</span><div class="pt-track xp"><i id="pt-xp"></i></div><b id="pt-xp-t">0/50</b></div>
          </div>
          <div class="pt-actions">
            <button type="button" class="pt-btn main" id="pt-feed"><span>🥕</span> Kasih makan <em id="pt-carrots">0</em></button>
            <button type="button" class="pt-btn" id="pt-rub"><span>🤲</span> Elus</button>
            <button type="button" class="pt-btn" onclick="switchMode('mochi')"><span>🍡</span> Main Mochi</button>
          </div>
          <p class="pt-how">Setiap <b>${POINTS_PER_CARROT} poin belajar</b> = 1 🥕. Poin didapat dari balik flashcard, tandai kanji hafal, menang Memory (+5), dan tangkap mochi. <span id="pt-points"></span></p>
        </div>
        <div class="pt-side">
          <div class="pt-panel">
            <div class="pt-ph"><h4>🎯 Misi harian</h4><small>reset tiap hari</small></div>
            <ul class="pt-missions" id="pt-missions"></ul>
            <p class="pt-bonus" id="pt-bonus"></p>
          </div>
          <div class="pt-panel">
            <div class="pt-ph"><h4>👗 Lemari baju</h4><small>naik level = baju baru</small></div>
            <div class="pt-closet" id="pt-closet"></div>
          </div>
          <div class="pt-panel pt-words">
            <div class="pt-ph"><h4>💬 Kata dari Usagi</h4><small>diajarin tiap kamu main</small></div>
            <ul id="pt-words"></ul>
          </div>
        </div>
      </div>`;
    ['pt-lv', 'pt-mood', 'pt-room', 'pt-bubble', 'pt-pet', 'pt-fx', 'pt-full', 'pt-full-t', 'pt-xp', 'pt-xp-t', 'pt-feed', 'pt-rub', 'pt-carrots', 'pt-points', 'pt-missions', 'pt-bonus', 'pt-closet', 'pt-words'].forEach(id => els[id] = $(id));
    els['pt-pet'].innerHTML = svg();
    els['pt-pet'].addEventListener('click', rub);
    els['pt-rub'].addEventListener('click', rub);
    els['pt-feed'].addEventListener('click', feed);
    els['pt-closet'].addEventListener('click', e => {
      const b = e.target.closest('[data-item]'); if (!b || b.disabled) return;
      const it = ITEMS.find(x => x.id === b.dataset.item);
      S.wear[it.slot] = S.wear[it.slot] === it.id ? null : it.id; save(); render();
      if (S.wear[it.slot]) { bounce(); say(['にあう？', 'niau?', 'cocok nggak?']); }
    });
    els['pt-missions'].addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) switchMode(b.dataset.go); });
  }

  let heard = [];
  try { heard = JSON.parse(localStorage.getItem('usagi-pet-words')) || []; } catch (_) {}
  function say(p) {
    const [jp, ro, id] = p;
    els['pt-bubble'].innerHTML = `<b class="font-jp">${jp}</b><small>${ro}</small><em>= ${id}</em>`;
    els['pt-bubble'].classList.remove('show'); void els['pt-bubble'].offsetWidth; els['pt-bubble'].classList.add('show');
    clearTimeout(bubbleT); bubbleT = setTimeout(() => els['pt-bubble'].classList.remove('show'), 4200);
    if (!heard.some(w => w[0] === jp)) { heard.unshift(p); heard = heard.slice(0, 12); try { localStorage.setItem('usagi-pet-words', JSON.stringify(heard)); } catch (_) {} renderWords(); }
  }
  function renderWords() {
    els['pt-words'].innerHTML = heard.length
      ? heard.map(([jp, ro, id]) => `<li><b class="font-jp">${jp}</b><span>${ro}</span><em>${id}</em></li>`).join('')
      : '<li class="pt-empty">Elus atau suapin Usagi, nanti dia ngajarin kata Jepang di sini ♡</li>';
  }
  function pop(chars, n = 6) {
    if (reduce) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span'); s.textContent = pick(chars);
      s.style.cssText = `--x:${(Math.random() * 120 - 60).toFixed(0)}px;--d:${(Math.random() * .25).toFixed(2)}s;left:${45 + Math.random() * 10}%`;
      els['pt-fx'].appendChild(s); setTimeout(() => s.remove(), 1400);
    }
  }
  function bounce(cls = 'jump') {
    const p = els['pt-pet']; p.classList.remove('jump', 'eat', 'nope'); void p.offsetWidth; p.classList.add(cls);
    setTimeout(() => p.classList.remove(cls), 900);
  }
  function rub() {
    tick();
    if (mood() === 'sleep') { wokenUntil = Date.now() + 60e3; say(pick(SAY.sleep)); render(); bounce('nope'); return; }
    bounce(); pop(['💗', '💖', '💕', '✨', '🌸'], 7);
    say(S.full < 35 && Math.random() < .6 ? pick(SAY.hungry) : pick(SAY.pet));
    els['pt-pet'].classList.add('blushy'); setTimeout(() => els['pt-pet'].classList.remove('blushy'), 1500);
  }
  function feed() {
    tick();
    if (S.carrots <= 0) { bounce('nope'); say(pick(SAY.empty)); toast('Wortelnya habis 🥺 Belajar dulu yuk biar dapat 🥕'); return; }
    if (S.full >= 98) { bounce('nope'); say(pick(SAY.full)); return; }
    wokenUntil = Date.now() + 60e3;
    const lvBefore = level();
    S.carrots--; S.full = Math.min(100, S.full + FEED_FULL); S.xp += FEED_XP; S.fed++;
    save();
    const c = document.createElement('span'); c.className = 'pt-carrot'; c.textContent = '🥕'; els['pt-room'].appendChild(c);
    setTimeout(() => c.remove(), 900);
    setTimeout(() => { bounce('eat'); pop(['😋', '💗', '✨', '🥕'], 5); }, reduce ? 0 : 550);
    const lv = level();
    if (lv > lvBefore) {
      setTimeout(() => {
        say(pick(SAY.level));
        const it = ITEMS.find(x => x.lv === lv);
        toast(`🎉 Usagi naik ke <b>Level ${lv}</b>!${it ? ` Baju baru: ${it.ic} ${it.name}` : ''}`);
        if (it) S.wear[it.slot] = it.id;
        save(); render(); pop(['🎉', '⭐', '✨', '💖'], 12);
      }, 900);
    } else setTimeout(() => say(pick(SAY.feed)), reduce ? 0 : 550);
    render();
  }

  function render() {
    if (!built) return;
    tick();
    const lv = level(), md = mood();
    const cur = xpFor(lv), next = xpFor(lv + 1);
    els['pt-lv'].textContent = `Lv ${lv}`;
    els['pt-mood'].textContent = MOOD_TXT[md];
    els['pt-mood'].dataset.mood = md;
    els['pt-room'].dataset.mood = md;
    els['pt-room'].classList.toggle('night', isNight());
    els['pt-pet'].querySelector('svg').setAttribute('class', `pt-svg m-${md} ${wearClasses()}`);
    const f = Math.round(S.full);
    els['pt-full'].style.width = f + '%';
    els['pt-full'].dataset.low = f < 35 ? '1' : '';
    els['pt-full-t'].textContent = f + '%';
    els['pt-xp'].style.width = Math.round((S.xp - cur) / (next - cur) * 100) + '%';
    els['pt-xp-t'].textContent = `${S.xp - cur}/${next - cur}`;
    els['pt-carrots'].textContent = S.carrots;
    const left = POINTS_PER_CARROT - (S.points % POINTS_PER_CARROT);
    els['pt-points'].textContent = `Wortel berikutnya: ${Number.isInteger(left) ? left : left.toFixed(1)} poin lagi.`;
    els['pt-missions'].innerHTML = MISSIONS.map(m => {
      const n = Math.min(m.goal, S.mis[m.id] || 0), done = !!S.done[m.id];
      return `<li class="${done ? 'done' : ''}"><span class="pt-mi ${m.id === 'kanji' ? 'font-jp' : ''}">${done ? '✓' : m.ic}</span>
        <div><b>${m.name}</b><div class="pt-track sm"><i style="width:${n / m.goal * 100}%"></i></div></div>
        ${done ? `<span class="pt-got">+${MISSION_REWARD} 🥕</span>` : `<button type="button" data-go="${m.go}">${n}/${m.goal} →</button>`}</li>`;
    }).join('');
    els['pt-bonus'].innerHTML = S.bonus ? `🏆 Semua misi beres! Bonus <b>+${ALL_BONUS} 🥕</b> sudah masuk.` : `Selesaikan semua misi untuk bonus <b>+${ALL_BONUS} 🥕</b>`;
    els['pt-closet'].innerHTML = ITEMS.map(it => {
      const locked = lv < it.lv, on = S.wear[it.slot] === it.id;
      return `<button type="button" data-item="${it.id}" class="${on ? 'on' : ''}" ${locked ? 'disabled' : ''} aria-pressed="${on}" title="${it.name}">
        <span>${locked ? '🔒' : it.ic}</span><small>${locked ? 'Lv ' + it.lv : it.name}</small></button>`;
    }).join('');
  }

  function renderBadge() {
    tick();
    const b = $('pet-badge'), hungry = S.full < 35;
    if (b) { b.hidden = !(S.carrots > 0 || hungry); b.textContent = hungry ? '!' : S.carrots; b.classList.toggle('alert', hungry); }
    const h = $('hc-pet-status');
    if (h) h.textContent = `Lv ${level()} • ${MOOD_TXT[mood()]} • ${S.carrots} 🥕`;
  }

  let clock;
  function show() {
    build(); visible = true; renderWords(); render();
    const md = mood();
    setTimeout(() => say(md === 'sleep' ? pick(SAY.sleep) : md === 'hungry' || md === 'starving' ? pick(SAY.hungry) : pick(SAY.hello)), 350);
    clearInterval(clock); clock = setInterval(render, 60e3);
  }
  function hide() { visible = false; clearInterval(clock); }

  tick(); save();
  const ready = () => { renderBadge(); setInterval(renderBadge, 5 * 60e3); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

  window.UsagiPet = { study, svg, show, hide, wearClasses, toast };
})();
