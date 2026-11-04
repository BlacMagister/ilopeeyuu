/* ============ Usagi Peliharaan — a study-powered Tamagotchi 🐰🥕 ============
 * Studying anywhere on the site earns study points → carrots. Carrots feed
 * Usagi; feeding gives XP → levels → new outfits. Achievements unlock extra
 * outfits, fur colours and rooms. Every outfit can be recoloured.
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

  /* ---------- wardrobe ---------- */
  const SLOTS = { ear: 'Telinga', head: 'Kepala', face: 'Wajah', neck: 'Leher', body: 'Badan', back: 'Punggung', hand: 'Tangan' };
  // lv = unlocked by level · otherwise unlocked by the achievement that rewards it
  const ITEMS = [
    { id: 'bow', slot: 'ear', lv: 1, ic: '🎀', name: 'Pita', color: '#e75b94' },
    { id: 'flower', slot: 'head', lv: 2, ic: '🌸', name: 'Bunga sakura', color: '#ffb6d2' },
    { id: 'scarf', slot: 'neck', lv: 3, ic: '🧣', name: 'Syal hangat', color: '#ff7aa8' },
    { id: 'glasses', slot: 'face', lv: 4, ic: '👓', name: 'Kacamata bulat', color: '#7a4b35' },
    { id: 'crown', slot: 'head', lv: 5, ic: '👑', name: 'Mahkota', color: '#ffd35c' },
    { id: 'kimono', slot: 'body', lv: 6, ic: '👘', name: 'Kimono', color: '#ff9cc4' },
    { id: 'cap', slot: 'head', lv: 7, ic: '🎓', name: 'Topi wisuda', color: '#4b3c59' },
    { id: 'hoodie', slot: 'body', ic: '🧥', name: 'Hoodie', color: '#8fc8ff' },
    { id: 'headphones', slot: 'ear', ic: '🎧', name: 'Headphone', color: '#8a63f0' },
    { id: 'mask', slot: 'face', ic: '🦊', name: 'Topeng kitsune', color: '#e8466f' },
    { id: 'heartglasses', slot: 'face', ic: '😍', name: 'Kacamata hati', color: '#ff5c9a' },
    { id: 'neko', slot: 'head', ic: '🐱', name: 'Bando kucing', color: '#3b2f46' },
    { id: 'hachimaki', slot: 'head', ic: '🔥', name: 'Hachimaki', color: '#e8466f' },
    { id: 'halo', slot: 'head', ic: '😇', name: 'Halo', color: '#ffd35c' },
    { id: 'cape', slot: 'back', ic: '🦸', name: 'Jubah pahlawan', color: '#e8466f' },
    { id: 'umbrella', slot: 'hand', ic: '☂️', name: 'Payung', color: '#ff9cc4' },
    { id: 'wand', slot: 'hand', ic: '🪄', name: 'Tongkat bintang', color: '#ffd35c' },
  ];
  const FURS = [
    { id: 'white', name: 'Putih', c: '#ffffff', l: '#f3bcd3', in: '#ffc8de' },
    { id: 'cream', name: 'Krem', c: '#fff3da', l: '#e9c796', in: '#ffd0b5' },
    { id: 'gray', name: 'Abu', c: '#ecebf2', l: '#b9b3c9', in: '#ffc8de' },
    { id: 'choco', name: 'Coklat susu', c: '#ecd2b8', l: '#bf946c', in: '#ffbfa8' },
    { id: 'sakura', name: 'Sakura', c: '#ffe1ed', l: '#f0a3c3', in: '#ff9cc4' },
    { id: 'lavender', name: 'Lavender', c: '#ece4ff', l: '#b6a3ea', in: '#ffc0e0' },
  ];
  const ROOMS = [
    { id: 'pink', name: 'Kamar pink', ic: '🌸' },
    { id: 'matcha', name: 'Taman matcha', ic: '🍵' },
    { id: 'starry', name: 'Langit bintang', ic: '🌌' },
  ];
  const PALETTE = ['#e75b94', '#ff9cc4', '#ff8a3d', '#ffd35c', '#5cc48a', '#4fa3e0', '#8a63f0', '#3b2f46', '#ffffff'];

  const MISSIONS = [
    { id: 'flash', ic: '🃏', name: 'Balik 5 flashcard', goal: 5, go: 'flashcard' },
    { id: 'memory', ic: '🧩', name: 'Menang 1x Memory Match', goal: 1, go: 'memory' },
    { id: 'kanji', ic: '漢', name: 'Tandai 5 kanji "Hafal"', goal: 5, go: 'kanji' },
    { id: 'mochi', ic: '🍡', name: 'Tangkap 15 mochi', goal: 15, go: 'mochi' },
  ];
  const MISSION_REWARD = 2, ALL_BONUS = 3;

  /* ---------- achievements → rewards ---------- */
  const ACH = [
    { id: 'first', ic: '🌱', name: 'Langkah pertama', desc: 'Dapat poin belajar pertama', goal: 1, get: () => S.points, reward: { carrots: 2 } },
    { id: 'flash50', ic: '🃏', name: 'Kartu master', desc: 'Balik 50 flashcard', goal: 50, get: () => S.st.flash, reward: { item: 'hoodie' } },
    { id: 'kanji20', ic: '漢', jp: 1, name: 'Kanji pemula', desc: 'Tandai 20 kanji hafal', goal: 20, get: () => S.st.kanji, reward: { item: 'headphones' } },
    { id: 'kanji60', ic: '📜', name: 'Sensei kanji', desc: 'Tandai 60 kanji hafal', goal: 60, get: () => S.st.kanji, reward: { item: 'mask' } },
    { id: 'mem5', ic: '🧩', name: 'Ingatan tajam', desc: 'Menang Memory Match 5x', goal: 5, get: () => S.st.memory, reward: { item: 'heartglasses' } },
    { id: 'mochi100', ic: '🍡', name: 'Pemburu mochi', desc: 'Tangkap total 100 mochi', goal: 100, get: () => S.st.mochi, reward: { item: 'neko' } },
    { id: 'combo10', ic: '🔥', name: 'Combo membara', desc: 'Combo x10 di Tangkap Mochi', goal: 10, get: () => S.st.combo, reward: { item: 'hachimaki' } },
    { id: 'score40', ic: '🏆', name: 'Jago kana', desc: 'Skor 40 dalam satu game Mochi', goal: 40, get: () => S.st.score, reward: { item: 'cape' } },
    { id: 'fed20', ic: '🥕', name: 'Koki Usagi', desc: 'Suapin Usagi 20x', goal: 20, get: () => S.fed, reward: { fur: 'choco' } },
    { id: 'rub30', ic: '🤲', name: 'Sayang Usagi', desc: 'Elus Usagi 30x', goal: 30, get: () => S.st.rub, reward: { fur: 'sakura' } },
    { id: 'streak3', ic: '📅', name: '3 hari beruntun', desc: 'Belajar 3 hari berturut-turut', goal: 3, get: () => S.st.bestStreak, reward: { item: 'umbrella' } },
    { id: 'streak7', ic: '🌟', name: 'Seminggu rajin', desc: 'Belajar 7 hari berturut-turut', goal: 7, get: () => S.st.bestStreak, reward: { item: 'wand', room: 'starry' } },
    { id: 'mis3', ic: '🎯', name: 'Misi sempurna', desc: 'Beresin semua misi harian di 3 hari', goal: 3, get: () => S.st.misDays, reward: { item: 'halo' } },
    { id: 'lv5', ic: '⭐', name: 'Usagi dewasa', desc: 'Usagi sampai Level 5', goal: 5, get: () => level(), reward: { room: 'matcha', carrots: 3 } },
    { id: 'fashion', ic: '👗', name: 'Fashionista', desc: 'Koleksi 10 baju', goal: 10, get: () => ITEMS.filter(owned).length, reward: { fur: 'lavender' } },
  ];
  const achForItem = {}, achForFur = {}, achForRoom = {};
  ACH.forEach(a => { if (a.reward.item) achForItem[a.reward.item] = a; if (a.reward.fur) achForFur[a.reward.fur] = a; if (a.reward.room) achForRoom[a.reward.room] = a; });
  const byId = id => ITEMS.find(x => x.id === id);
  const rewardText = r => [r.item && `${byId(r.item).ic} ${byId(r.item).name}`, r.fur && `🎨 Bulu ${FURS.find(f => f.id === r.fur).name}`,
    r.room && `${ROOMS.find(x => x.id === r.room).ic} ${ROOMS.find(x => x.id === r.room).name}`, r.carrots && `+${r.carrots} 🥕`].filter(Boolean).join(' · ');

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
    dress: [['にあう？', 'niau?', 'cocok nggak?'], ['おしゃれでしょ', 'oshare desho', 'modis kan?'], ['かわいい！', 'kawaii!', 'lucu!'], ['いろがすき', 'iro ga suki', 'aku suka warnanya']],
    prize: [['ごほうびだ！', 'gohoubi da!', 'hadiah!'], ['すごい！', 'sugoi!', 'hebat!']],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dayStr = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = () => dayStr(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); };

  /* ---------- state ---------- */
  const freshSt = () => ({ flash: 0, kanji: 0, memory: 0, mochi: 0, combo: 0, score: 0, rub: 0, misDays: 0, streak: 0, bestStreak: 0, streakDay: '' });
  const fresh = () => ({ carrots: 3, full: 60, last: Date.now(), xp: 0, points: 0, fed: 0,
    wear: { ear: 'bow', head: null, face: null, neck: null, body: null, back: null, hand: null }, day: today(), mis: {}, done: {}, bonus: false, seen: [],
    st: freshSt(), ach: {}, colors: {}, fur: 'white', room: 'pink', fresh: [] });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) { S = fresh(); }
  S.st = Object.assign(freshSt(), S.st || {});
  S.wear = Object.assign(fresh().wear, S.wear || {});
  if (S.wear.body === 'scarf') { S.wear.body = null; S.wear.neck = 'scarf'; } // scarf moved to its own slot
  // older saves: best Tangkap Mochi score counts toward "Jago kana"
  try { ['hira', 'kata', 'mix'].forEach(k => { S.st.score = Math.max(S.st.score, +localStorage.getItem('mochi-best-' + k) || 0); }); } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  function tick() {
    const now = Date.now();
    S.full = Math.max(0, S.full - (now - S.last) / 36e5 * DECAY_PER_HOUR);
    S.last = now;
    if (S.day !== today()) { S.day = today(); S.mis = {}; S.done = {}; S.bonus = false; S.seen = []; }
  }
  const level = () => { let lv = 1; while (S.xp >= xpFor(lv + 1)) lv++; return lv; };
  const owned = it => it.lv ? level() >= it.lv : !!(achForItem[it.id] && S.ach[achForItem[it.id].id]);
  const furOwned = f => !achForFur[f.id] || !!S.ach[achForFur[f.id].id];
  const roomOwned = r => !achForRoom[r.id] || !!S.ach[achForRoom[r.id].id];
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

  /* ---------- SVG (shared with Tangkap Mochi) ----------
   * Fur parts use the .fur classes; outfit parts read --k-<item> so every outfit can be recoloured. */
  const K = (id, def) => `fill="${def}" style="fill:var(--k-${id},${def})"`;
  const KD = (id, def) => `fill="${def}" style="fill:color-mix(in srgb,var(--k-${id},${def}) 68%,#2a1630)"`;
  const KF = (id, def, w = 1.5) => `fill="${def}" stroke="${def}" stroke-width="${w}" style="fill:var(--k-${id},${def});stroke:color-mix(in srgb,var(--k-${id},${def}) 68%,#2a1630)"`;
  const KS = (id, def) => `stroke="${def}" style="stroke:var(--k-${id},${def})"`;
  const heart = (x, y) => `M${x} ${y + 6} C${x - 11} ${y - 1} ${x - 6} ${y - 10} ${x} ${y - 4} C${x + 6} ${y - 10} ${x + 11} ${y - 1} ${x} ${y + 6} Z`;
  let uid = 0;
  function svg(cls = '', style = '') {
    const c = 'ptclip' + (++uid);
    return `<svg class="pt-svg ${cls}" style="${style}" viewBox="-8 -12 116 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><clipPath id="${c}"><ellipse cx="50" cy="93" rx="27" ry="15"/></clipPath></defs>
      <g class="acc acc-cape"><path d="M30 80 Q18 98 12 113 Q50 121 88 113 Q82 98 70 80 Z" ${KF('cape', '#e8466f')}/></g>
      <g class="acc acc-umbrella"><path d="M22 92 L12 46" stroke="#8a5a3c" stroke-width="2.2" stroke-linecap="round"/><path d="M-6 50 Q12 22 30 44 Q26 40 21 46 Q17 40 12 47 Q7 40 3 47 Q-1 41 -6 50 Z" ${KF('umbrella', '#ff9cc4', 1.2)}/><circle cx="12" cy="31" r="1.8" fill="#8a5a3c"/></g>
      <g class="pt-ear l"><ellipse class="fur" cx="36" cy="24" rx="10" ry="24" stroke-width="2"/><ellipse class="fur-in" cx="36" cy="26" rx="5" ry="16"/></g>
      <g class="pt-ear r"><ellipse class="fur" cx="64" cy="24" rx="10" ry="24" stroke-width="2"/><ellipse class="fur-in" cx="64" cy="26" rx="5" ry="16"/></g>
      <g class="acc acc-halo"><ellipse cx="50" cy="-5" rx="17" ry="4.5" fill="none" stroke-width="3.2" ${KS('halo', '#ffd35c')}/></g>
      <g class="acc acc-bow"><path d="M60 10 l8 -6 l2 9 z M60 10 l-9 -4 l3 9 z" ${K('bow', '#e75b94')}/><circle cx="60" cy="10" r="3" ${KD('bow', '#e75b94')}/></g>
      <ellipse class="fur" cx="24" cy="88" rx="7" ry="10" stroke-width="2"/>
      <ellipse class="fur" cx="76" cy="88" rx="7" ry="10" stroke-width="2"/>
      <ellipse class="fur" cx="50" cy="93" rx="27" ry="15" stroke-width="2"/>
      <g class="acc acc-kimono" clip-path="url(#${c})"><rect x="20" y="76" width="60" height="34" ${K('kimono', '#ff9cc4')}/><circle cx="32" cy="104" r="2.4" fill="#fff" opacity=".8"/><circle cx="68" cy="102" r="2.4" fill="#fff" opacity=".8"/><circle cx="58" cy="106" r="1.8" fill="#fff" opacity=".8"/><rect x="20" y="98" width="60" height="5" ${KD('kimono', '#ff9cc4')}/></g>
      <g class="acc acc-hoodie" clip-path="url(#${c})"><rect x="20" y="76" width="60" height="34" ${K('hoodie', '#8fc8ff')}/><rect x="38" y="99" width="24" height="9" rx="4" ${KD('hoodie', '#8fc8ff')} opacity=".55"/></g>
      <circle class="fur" cx="50" cy="66" r="30" stroke-width="2"/>
      <g class="acc acc-kimono"><path d="M43 95 L50 102 L57 95" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/></g>
      <g class="acc acc-hoodie"><path d="M45 95 l-2 9 M55 95 l2 9" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="43" cy="105" r="1.6" fill="#fff"/><circle cx="57" cy="105" r="1.6" fill="#fff"/></g>
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
      <g class="acc acc-scarf"><path d="M24 86 Q50 100 76 86 L76 93 Q50 107 24 93 Z" ${KF('scarf', '#ff7aa8', 1)}/><rect x="60" y="94" width="8" height="15" rx="3" ${KF('scarf', '#ff7aa8', 1)}/></g>
      <g class="acc acc-glasses" fill="none" stroke-width="2" ${KS('glasses', '#7a4b35')}><circle cx="39" cy="64" r="8" fill="#fff" fill-opacity=".25"/><circle cx="61" cy="64" r="8" fill="#fff" fill-opacity=".25"/><path d="M47 63 q3 -3 6 0"/></g>
      <g class="acc acc-heartglasses"><path d="${heart(39, 64)} ${heart(61, 64)}" ${K('heartglasses', '#ff5c9a')} fill-opacity=".9"/><path d="M47 62 q3 -3 6 0" fill="none" stroke-width="2" ${KS('heartglasses', '#ff5c9a')}/><circle cx="36" cy="61" r="1.6" fill="#fff" opacity=".8"/><circle cx="58" cy="61" r="1.6" fill="#fff" opacity=".8"/></g>
      <g class="acc acc-mask" transform="translate(73 47) rotate(18)"><path d="M-9 -7 L-7 -15 L-2 -8 L2 -8 L7 -15 L9 -7 Q10 4 0 12 Q-10 4 -9 -7 Z" fill="#fff" stroke="#d8cbd3" stroke-width="1"/><path d="M-6 -3 l4 1.5 M6 -3 l-4 1.5" stroke-width="1.8" stroke-linecap="round" ${KS('mask', '#e8466f')}/><path d="M-7 -12 L-6 -8 M7 -12 L6 -8" stroke-width="2" ${KS('mask', '#e8466f')}/><circle cx="0" cy="7" r="1.6" ${K('mask', '#e8466f')}/></g>
      <g class="acc acc-flower" transform="translate(27 43)"><g ${KF('flower', '#ffb6d2', .8)}><circle cx="0" cy="-5" r="4"/><circle cx="4.8" cy="-1.5" r="4"/><circle cx="3" cy="4" r="4"/><circle cx="-3" cy="4" r="4"/><circle cx="-4.8" cy="-1.5" r="4"/></g><circle r="2.4" fill="#ffd35c"/></g>
      <g class="acc acc-crown"><path d="M35 42 L36 26 L43 34 L50 22 L57 34 L64 26 L65 42 Z" ${KF('crown', '#ffd35c')} stroke-linejoin="round"/><circle cx="50" cy="35" r="2.5" fill="#ff5c9a"/></g>
      <g class="acc acc-cap"><rect x="35" y="33" width="30" height="9" rx="2" ${KD('cap', '#4b3c59')}/><path d="M50 22 L80 31 L50 40 L20 31 Z" ${KF('cap', '#4b3c59', 1)}/><path d="M50 31 L72 34 L72 46" stroke="#ffd35c" stroke-width="1.6" fill="none"/><circle cx="72" cy="47" r="2.4" fill="#ffd35c"/></g>
      <g class="acc acc-neko"><path d="M24 50 Q50 28 76 50" fill="none" stroke-width="3.2" ${KS('neko', '#3b2f46')}/><path d="M27 46 L29 24 L44 36 Z M73 46 L71 24 L56 36 Z" ${KF('neko', '#3b2f46', 1)} stroke-linejoin="round"/><path d="M31 40 L32 30 L39 36 Z M69 40 L68 30 L61 36 Z" fill="#ffb6d2"/></g>
      <g class="acc acc-hachimaki"><path d="M21 52 Q50 40 79 52 L79 58 Q50 46 21 58 Z" fill="#fff" stroke="#e3d5dc" stroke-width="1"/><circle cx="50" cy="48.5" r="3.6" ${K('hachimaki', '#e8466f')}/><path d="M78 54 l12 -7 l-2 6 l4 4 z" fill="#fff" stroke="#e3d5dc" stroke-width="1"/></g>
      <g class="acc acc-headphones"><path d="M21 60 Q22 30 50 30 Q78 30 79 60" fill="none" stroke-width="4" stroke-linecap="round" ${KS('headphones', '#8a63f0')}/><rect x="15" y="54" width="11" height="19" rx="5" ${KF('headphones', '#8a63f0', 1)}/><rect x="74" y="54" width="11" height="19" rx="5" ${KF('headphones', '#8a63f0', 1)}/><circle cx="20.5" cy="63.5" r="2.4" fill="#fff" opacity=".7"/><circle cx="79.5" cy="63.5" r="2.4" fill="#fff" opacity=".7"/></g>
      <ellipse class="fur" cx="36" cy="106" rx="9" ry="5" stroke-width="2"/>
      <ellipse class="fur" cx="64" cy="106" rx="9" ry="5" stroke-width="2"/>
      <g class="acc acc-wand"><path d="M77 93 L93 68" stroke="#8a5a3c" stroke-width="2.4" stroke-linecap="round"/><path d="M94 56 l2.6 6 l6.4 .6 l-4.9 4.2 l1.5 6.3 l-5.6 -3.4 l-5.6 3.4 l1.5 -6.3 l-4.9 -4.2 l6.4 -.6 z" ${KF('wand', '#ffd35c', 1)} stroke-linejoin="round"/><circle cx="101" cy="54" r="1.4" fill="#fff"/><circle cx="86" cy="58" r="1" fill="#fff"/></g>
    </svg>`;
  }
  const wearClasses = () => Object.values(S.wear).filter(Boolean).map(id => 'w-' + id).join(' ');
  function wearStyle() {
    const f = FURS.find(x => x.id === S.fur) || FURS[0];
    let s = `--fur:${f.c};--fur-line:${f.l};--fur-in:${f.in};`;
    for (const [id, c] of Object.entries(S.colors)) if (/^#[0-9a-f]{6}$/i.test(c)) s += `--k-${id}:${c};`;
    return s;
  }
  const dress = (extra = '') => svg(`${extra} ${wearClasses()}`, wearStyle());

  /* ---------- toast ---------- */
  let toastEl, toastT;
  function toast(html, ms = 2600) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pt-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = html; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  /* ---------- achievements ---------- */
  let pending = []; // unlocked during Tangkap Mochi → shown on its results card instead of a toast
  const inMochi = () => document.body.dataset.mode === 'mochi';
  function checkAch() {
    const got = [];
    let again = true;
    while (again) { // one reward can unlock another (e.g. Fashionista)
      again = false;
      for (const a of ACH) {
        if (S.ach[a.id] || a.get() < a.goal) continue;
        S.ach[a.id] = Date.now(); got.push(a); again = true;
        if (a.reward.carrots) S.carrots += a.reward.carrots;
        if (a.reward.item) S.fresh.push(a.reward.item);
        if (a.reward.fur) S.fresh.push('fur:' + a.reward.fur);
        if (a.reward.room) S.fresh.push('room:' + a.reward.room);
      }
    }
    if (!got.length) return got;
    save();
    if (inMochi()) pending.push(...got);
    else announce(got);
    return got;
  }
  function announce(list) {
    if (!list.length) return;
    const a = list[0];
    toast(`🏅 Pencapaian: <b>${a.name}</b>!<small>Hadiah: ${rewardText(a.reward)}${list.length > 1 ? ` · +${list.length - 1} pencapaian lain` : ''}</small>`, 4200);
    if (visible) { render(); bounce(); pop(['🏅', '🎁', '✨', '💖'], 10); setTimeout(() => say(pick(SAY.prize)), 300); }
    if (!reduce) confetti();
  }
  function confetti() {
    const colors = ['#ff8fb8', '#ffd35c', '#9be3b0', '#b9a6ff', '#ffb38a'];
    for (let i = 0; i < 32; i++) {
      const c = document.createElement('div'); c.className = 'confetti';
      c.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % 5]};--dx:${(Math.random() * 160 - 80).toFixed(0)}px;animation-delay:${(Math.random() * .4).toFixed(2)}s`;
      document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
    }
  }

  /* ---------- study hook (called by the other modes) ---------- */
  function study(type, key) {
    tick();
    if (key) { const k = type + ':' + key; if (S.seen.includes(k)) return; S.seen.push(k); if (S.seen.length > 400) S.seen.shift(); }
    if (type in S.st) S.st[type]++;
    // daily streak
    if (S.st.streakDay !== today()) {
      S.st.streak = S.st.streakDay === yesterday() ? S.st.streak + 1 : 1;
      S.st.streakDay = today();
      S.st.bestStreak = Math.max(S.st.bestStreak, S.st.streak);
    }
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
        if (!S.bonus && MISSIONS.every(x => S.done[x.id])) { S.bonus = true; S.st.misDays++; S.carrots += ALL_BONUS; msg = `🏆 Semua misi hari ini beres! <b>+${MISSION_REWARD + ALL_BONUS} 🥕</b>`; }
      }
    }
    save();
    const ach = checkAch();
    renderBadge();
    if (visible) render();
    if (ach.length && !inMochi()) return; // the achievement toast wins
    const mission = /^(🎯|🏆)/u.test(msg);
    // During Tangkap Mochi only mission toasts are shown, so the game isn't covered by popups.
    if (msg && (type !== 'mochi' || mission)) toast(mission ? msg : msg + ' <small>Usagi nunggu disuapin 🐰</small>');
  }

  /* Tangkap Mochi reports a finished round; returns achievements to list on its results card. */
  function mochiEnd({ score = 0, combo = 0 } = {}) {
    S.st.score = Math.max(S.st.score, score);
    S.st.combo = Math.max(S.st.combo, combo);
    save(); checkAch(); renderBadge();
    const list = pending; pending = [];
    return list.map(a => ({ ic: a.ic, name: a.name, reward: rewardText(a.reward) }));
  }

  /* ---------- UI ---------- */
  let visible = false, built = false, bubbleT, editing = null, lastRub = 0;
  const els = {};
  function build() {
    if (built) return; built = true;
    const root = $('pet-root'); if (!root) return;
    root.innerHTML = `
      <div class="pt-grid">
        <div class="pt-main">
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
          <div class="pt-panel pt-wardrobe">
            <div class="pt-ph"><h4>👗 Lemari baju</h4><small id="pt-own">0 baju</small></div>
            <div class="pt-slots" id="pt-slots" role="tablist" aria-label="Bagian baju"></div>
            <div class="pt-closet" id="pt-closet"></div>
            <div class="pt-custom" id="pt-custom"></div>
            <div class="pt-row">
              <span class="pt-lab">🐰 Warna bulu</span>
              <div class="pt-sw" id="pt-furs"></div>
            </div>
            <div class="pt-row">
              <span class="pt-lab">🏠 Kamar</span>
              <div class="pt-rooms" id="pt-rooms"></div>
            </div>
            <div class="pt-tools">
              <button type="button" class="pt-mini" id="pt-random">🎲 Gaya acak</button>
              <button type="button" class="pt-mini" id="pt-strip">🧺 Lepas semua</button>
            </div>
          </div>
        </div>
        <div class="pt-side">
          <div class="pt-panel">
            <div class="pt-ph"><h4>🎯 Misi harian</h4><small id="pt-streak">reset tiap hari</small></div>
            <ul class="pt-missions" id="pt-missions"></ul>
            <p class="pt-bonus" id="pt-bonus"></p>
          </div>
          <div class="pt-panel">
            <div class="pt-ph"><h4>🏅 Pencapaian</h4><small id="pt-ach-n">0/${ACH.length}</small></div>
            <ul class="pt-ach" id="pt-ach"></ul>
          </div>
          <div class="pt-panel pt-words">
            <div class="pt-ph"><h4>💬 Kata dari Usagi</h4><small>diajarin tiap kamu main</small></div>
            <ul id="pt-words"></ul>
          </div>
        </div>
      </div>`;
    ['pt-lv', 'pt-mood', 'pt-room', 'pt-bubble', 'pt-pet', 'pt-fx', 'pt-full', 'pt-full-t', 'pt-xp', 'pt-xp-t', 'pt-feed', 'pt-rub', 'pt-carrots', 'pt-points',
      'pt-missions', 'pt-bonus', 'pt-closet', 'pt-words', 'pt-slots', 'pt-custom', 'pt-furs', 'pt-rooms', 'pt-own', 'pt-ach', 'pt-ach-n', 'pt-streak'].forEach(id => els[id] = $(id));
    els['pt-pet'].innerHTML = svg();
    els['pt-pet'].addEventListener('click', rub);
    els['pt-rub'].addEventListener('click', rub);
    els['pt-feed'].addEventListener('click', feed);
    els['pt-slots'].addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { slotTab = b.dataset.slot; render(); } });
    els['pt-closet'].addEventListener('click', e => {
      const b = e.target.closest('[data-item]'); if (!b) return;
      const it = byId(b.dataset.item);
      unfresh(it.id);
      if (!owned(it)) {
        const a = achForItem[it.id];
        toast(it.lv ? `🔒 ${it.ic} ${it.name} terbuka di <b>Level ${it.lv}</b>` : `🔒 ${it.ic} ${it.name}<small>Pencapaian “${a.name}”: ${a.desc} (${Math.min(a.goal, Math.floor(a.get()))}/${a.goal})</small>`, 3400);
        render(); return;
      }
      if (S.wear[it.slot] === it.id) { S.wear[it.slot] = null; if (editing === it.id) editing = null; }
      else { S.wear[it.slot] = it.id; editing = it.id; bounce(); say(pick(SAY.dress)); }
      save(); render();
    });
    els['pt-custom'].addEventListener('click', e => {
      const t = e.target.closest('[data-edit]'); if (t) { editing = t.dataset.edit; render(); return; }
      const c = e.target.closest('[data-color]'); if (!c || !editing) return;
      if (c.dataset.color === 'reset') delete S.colors[editing]; else S.colors[editing] = c.dataset.color;
      save(); render(); bounce(); if (Math.random() < .5) say(pick(SAY.dress));
    });
    els['pt-furs'].addEventListener('click', e => {
      const b = e.target.closest('[data-fur]'); if (!b) return;
      const f = FURS.find(x => x.id === b.dataset.fur); unfresh('fur:' + f.id);
      if (!furOwned(f)) { const a = achForFur[f.id]; toast(`🔒 Bulu ${f.name}<small>Pencapaian “${a.name}”: ${a.desc}</small>`, 3200); render(); return; }
      S.fur = f.id; save(); render(); bounce();
    });
    els['pt-rooms'].addEventListener('click', e => {
      const b = e.target.closest('[data-room]'); if (!b) return;
      const r = ROOMS.find(x => x.id === b.dataset.room); unfresh('room:' + r.id);
      if (!roomOwned(r)) { const a = achForRoom[r.id]; toast(`🔒 ${r.ic} ${r.name}<small>Pencapaian “${a.name}”: ${a.desc}</small>`, 3200); render(); return; }
      S.room = r.id; save(); render();
    });
    $('pt-random').addEventListener('click', () => {
      Object.keys(SLOTS).forEach(slot => {
        const opts = ITEMS.filter(it => it.slot === slot && owned(it));
        S.wear[slot] = opts.length && Math.random() < .65 ? pick(opts).id : null;
        if (S.wear[slot] && Math.random() < .5) S.colors[S.wear[slot]] = pick(PALETTE);
      });
      editing = Object.values(S.wear).find(Boolean) || null;
      save(); render(); bounce(); pop(['✨', '🎲', '💖'], 6); say(pick(SAY.dress));
    });
    $('pt-strip').addEventListener('click', () => { Object.keys(S.wear).forEach(k => S.wear[k] = null); editing = null; save(); render(); bounce('nope'); });
    els['pt-missions'].addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) switchMode(b.dataset.go); });
  }
  let slotTab = 'all';
  const unfresh = k => { const i = S.fresh.indexOf(k); if (i >= 0) { S.fresh.splice(i, 1); save(); renderBadge(); } };

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
    if (reduce || !els['pt-fx']) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span'); s.textContent = pick(chars);
      s.style.cssText = `--x:${(Math.random() * 120 - 60).toFixed(0)}px;--d:${(Math.random() * .25).toFixed(2)}s;left:${45 + Math.random() * 10}%`;
      els['pt-fx'].appendChild(s); setTimeout(() => s.remove(), 1400);
    }
  }
  function bounce(cls = 'jump') {
    const p = els['pt-pet']; if (!p) return; p.classList.remove('jump', 'eat', 'nope'); void p.offsetWidth; p.classList.add(cls);
    setTimeout(() => p.classList.remove(cls), 900);
  }
  function rub() {
    tick();
    if (mood() === 'sleep') { wokenUntil = Date.now() + 60e3; say(pick(SAY.sleep)); render(); bounce('nope'); return; }
    bounce(); pop(['💗', '💖', '💕', '✨', '🌸'], 7);
    say(S.full < 35 && Math.random() < .6 ? pick(SAY.hungry) : pick(SAY.pet));
    els['pt-pet'].classList.add('blushy'); setTimeout(() => els['pt-pet'].classList.remove('blushy'), 1500);
    if (Date.now() - lastRub > 1200) { lastRub = Date.now(); S.st.rub++; save(); if (checkAch().length) render(); }
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
        if (it) { S.wear[it.slot] = it.id; editing = it.id; }
        save(); render(); pop(['🎉', '⭐', '✨', '💖'], 12);
        setTimeout(checkAch, 2700);
      }, 900);
    } else { setTimeout(() => say(pick(SAY.feed)), reduce ? 0 : 550); setTimeout(checkAch, 700); }
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
    els['pt-room'].dataset.room = S.room;
    els['pt-room'].classList.toggle('night', isNight());
    const pet = els['pt-pet'].querySelector('svg');
    pet.setAttribute('class', `pt-svg m-${md} ${wearClasses()}`);
    pet.setAttribute('style', wearStyle());
    const f = Math.round(S.full);
    els['pt-full'].style.width = f + '%';
    els['pt-full'].dataset.low = f < 35 ? '1' : '';
    els['pt-full-t'].textContent = f + '%';
    els['pt-xp'].style.width = Math.round((S.xp - cur) / (next - cur) * 100) + '%';
    els['pt-xp-t'].textContent = `${S.xp - cur}/${next - cur}`;
    els['pt-carrots'].textContent = S.carrots;
    const left = POINTS_PER_CARROT - (S.points % POINTS_PER_CARROT);
    els['pt-points'].textContent = `Wortel berikutnya: ${Number.isInteger(left) ? left : left.toFixed(1)} poin lagi.`;
    const streakOn = S.st.streakDay === today() || S.st.streakDay === yesterday();
    els['pt-streak'].textContent = streakOn && S.st.streak > 0 ? `🔥 ${S.st.streak} hari beruntun` : 'reset tiap hari';
    els['pt-missions'].innerHTML = MISSIONS.map(m => {
      const n = Math.min(m.goal, S.mis[m.id] || 0), done = !!S.done[m.id];
      return `<li class="${done ? 'done' : ''}"><span class="pt-mi ${m.id === 'kanji' ? 'font-jp' : ''}">${done ? '✓' : m.ic}</span>
        <div><b>${m.name}</b><div class="pt-track sm"><i style="width:${n / m.goal * 100}%"></i></div></div>
        ${done ? `<span class="pt-got">+${MISSION_REWARD} 🥕</span>` : `<button type="button" data-go="${m.go}">${n}/${m.goal} →</button>`}</li>`;
    }).join('');
    els['pt-bonus'].innerHTML = S.bonus ? `🏆 Semua misi beres! Bonus <b>+${ALL_BONUS} 🥕</b> sudah masuk.` : `Selesaikan semua misi untuk bonus <b>+${ALL_BONUS} 🥕</b>`;
    renderWardrobe();
    renderAch();
  }

  function renderWardrobe() {
    const lv = level();
    const have = ITEMS.filter(owned).length;
    els['pt-own'].textContent = `${have}/${ITEMS.length} baju`;
    const tabs = [['all', 'Semua'], ...Object.entries(SLOTS)];
    els['pt-slots'].innerHTML = tabs.map(([k, n]) => {
      const dot = k !== 'all' && ITEMS.some(it => it.slot === k && S.fresh.includes(it.id));
      return `<button type="button" role="tab" data-slot="${k}" aria-selected="${slotTab === k}" class="${slotTab === k ? 'on' : ''}">${n}${dot ? '<i></i>' : ''}</button>`;
    }).join('');
    const list = ITEMS.filter(it => slotTab === 'all' || it.slot === slotTab);
    els['pt-closet'].innerHTML = list.map(it => {
      const has = owned(it), on = S.wear[it.slot] === it.id, isNew = S.fresh.includes(it.id);
      const a = achForItem[it.id];
      const lock = it.lv ? `Lv ${it.lv}` : `🏅 ${a.name}`;
      const col = S.colors[it.id] || it.color;
      return `<button type="button" data-item="${it.id}" class="${on ? 'on' : ''} ${has ? '' : 'locked'}" aria-pressed="${on}" title="${has ? it.name : 'Terkunci: ' + lock}">
        ${isNew && has ? '<em class="pt-new">BARU</em>' : ''}
        <span>${it.ic}</span><small>${has ? it.name : lock}</small>${has ? `<i style="background:${col}"></i>` : '<b class="pt-lock">🔒</b>'}</button>`;
    }).join('');
    void lv;

    // colour customiser for what Usagi is wearing
    const worn = Object.values(S.wear).filter(Boolean).map(byId).filter(Boolean);
    if (!worn.some(w => w.id === editing)) editing = worn[0] ? worn[0].id : null;
    if (!worn.length) {
      els['pt-custom'].innerHTML = '<p class="pt-hint">🎨 Pakaikan baju dulu, lalu ganti warnanya di sini.</p>';
    } else {
      const ed = byId(editing), cur = S.colors[editing] || ed.color;
      els['pt-custom'].innerHTML = `
        <div class="pt-row"><span class="pt-lab">🎨 Warnai</span>
          <div class="pt-chips">${worn.map(w => `<button type="button" data-edit="${w.id}" class="${w.id === editing ? 'on' : ''}" aria-pressed="${w.id === editing}">${w.ic} ${w.name}</button>`).join('')}</div></div>
        <div class="pt-sw" aria-label="Warna ${ed.name}">
          ${PALETTE.map(c => `<button type="button" data-color="${c}" class="${cur.toLowerCase() === c ? 'on' : ''}" style="--sw:${c}" aria-label="Warna ${c}"></button>`).join('')}
          <button type="button" data-color="reset" class="pt-reset" title="Warna asli" style="--sw:${ed.color}" aria-label="Warna asli">↺</button>
        </div>`;
    }
    els['pt-furs'].innerHTML = FURS.map(f => {
      const has = furOwned(f), on = S.fur === f.id, isNew = S.fresh.includes('fur:' + f.id);
      return `<button type="button" data-fur="${f.id}" class="${on ? 'on' : ''} ${has ? '' : 'locked'}" style="--sw:${f.c};--swl:${f.l}" title="${has ? f.name : 'Terkunci: ' + achForFur[f.id].name}" aria-label="Bulu ${f.name}">${has ? (isNew ? '<em class="pt-dot"></em>' : '') : '🔒'}</button>`;
    }).join('');
    els['pt-rooms'].innerHTML = ROOMS.map(r => {
      const has = roomOwned(r), on = S.room === r.id, isNew = S.fresh.includes('room:' + r.id);
      return `<button type="button" data-room="${r.id}" class="${on ? 'on' : ''} ${has ? '' : 'locked'}" aria-pressed="${on}">${isNew && has ? '<em class="pt-dot"></em>' : ''}${has ? r.ic : '🔒'} ${r.name}</button>`;
    }).join('');
  }

  function renderAch() {
    const done = ACH.filter(a => S.ach[a.id]).length;
    els['pt-ach-n'].textContent = `${done}/${ACH.length}`;
    // unlocked last, closest-to-done first, so the next goal is always on top
    const sorted = [...ACH].sort((a, b) => (!!S.ach[a.id] - !!S.ach[b.id]) || (b.get() / b.goal - a.get() / a.goal));
    els['pt-ach'].innerHTML = sorted.map(a => {
      const ok = !!S.ach[a.id], n = Math.min(a.goal, Math.floor(a.get()));
      return `<li class="${ok ? 'done' : ''}"><span class="pt-ai ${a.jp ? 'font-jp' : ''}">${ok ? '🏅' : a.ic}</span>
        <div><b>${a.name}</b><small>${a.desc}</small>${ok ? '' : `<div class="pt-track sm"><i style="width:${n / a.goal * 100}%"></i></div>`}</div>
        <span class="pt-rw">${ok ? '✓ ' : ''}${rewardText(a.reward)}${ok ? '' : `<em>${n}/${a.goal}</em>`}</span></li>`;
    }).join('');
  }

  function renderBadge() {
    tick();
    const b = $('pet-badge'), hungry = S.full < 35, gifts = S.fresh.length;
    if (b) { b.hidden = !(S.carrots > 0 || hungry || gifts); b.textContent = hungry ? '!' : gifts ? '🎁' : S.carrots; b.classList.toggle('alert', hungry); }
    const h = $('hc-pet-status');
    if (h) h.textContent = `Lv ${level()} • ${MOOD_TXT[mood()]} • ${S.carrots} 🥕 • 🏅 ${ACH.filter(a => S.ach[a.id]).length}/${ACH.length}`;
  }

  let clock;
  function show() {
    build(); visible = true; renderWords(); render();
    const md = mood();
    setTimeout(() => say(md === 'sleep' ? pick(SAY.sleep) : md === 'hungry' || md === 'starving' ? pick(SAY.hungry) : pick(SAY.hello)), 350);
    clearInterval(clock); clock = setInterval(render, 60e3);
    if (pending.length) { const p = pending; pending = []; setTimeout(() => announce(p), 600); }
  }
  function hide() { visible = false; clearInterval(clock); }

  tick();
  checkAch(); // grant achievements earned before this feature existed (level, best score…)
  save();
  const ready = () => { renderBadge(); setInterval(renderBadge, 5 * 60e3); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

  window.UsagiPet = { study, svg, dress, show, hide, wearClasses, wearStyle, toast, mochiEnd };
})();
