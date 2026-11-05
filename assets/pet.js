/* ============ Usagi Peliharaan — a study-powered Tamagotchi 🐰🥕 ============
 * Studying anywhere on the site earns study points → carrots + coins. Carrots
 * and snacks feed the pet; feeding gives XP → levels → new outfits.
 * Coins buy new animals, places, furniture, snacks and fur colours in the shop.
 * Achievements unlock extra outfits, fur colours and places. Every outfit can be recoloured.
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
  const COINS_PER_POINT = 2, MISSION_COINS = 10, BONUS_COINS = 20, LEVEL_COINS = 20, ACH_COINS = 15, GIFT_COINS = 8;

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
  // price = buy with coins in the shop · otherwise free or unlocked by an achievement
  const FURS = [
    { id: 'white', name: 'Putih', c: '#ffffff', l: '#f3bcd3', in: '#ffc8de' },
    { id: 'cream', name: 'Krem', c: '#fff3da', l: '#e9c796', in: '#ffd0b5' },
    { id: 'gray', name: 'Abu', c: '#ecebf2', l: '#b9b3c9', in: '#ffc8de' },
    { id: 'choco', name: 'Coklat susu', c: '#ecd2b8', l: '#bf946c', in: '#ffbfa8' },
    { id: 'sakura', name: 'Sakura', c: '#ffe1ed', l: '#f0a3c3', in: '#ff9cc4' },
    { id: 'lavender', name: 'Lavender', c: '#ece4ff', l: '#b6a3ea', in: '#ffc0e0' },
    { id: 'orange', name: 'Oranye rubah', c: '#ffd9b8', l: '#e8a06a', in: '#ffeadb' },
    { id: 'mint', name: 'Mint', c: '#dcf5ea', l: '#8fcfb0', in: '#ffc8de' },
    { id: 'sky', name: 'Biru langit', c: '#e0f0ff', l: '#93bde6', in: '#ffc8de', price: 50 },
    { id: 'lemon', name: 'Lemon', c: '#fff6c4', l: '#e3c867', in: '#ffd0b5', price: 50 },
  ];

  /* ---------- animals ---------- */
  const SPECIES = [
    { id: 'usagi', ic: '🐰', name: 'Usagi', jp: 'うさぎ · kelinci', def: 'Usagi-chan', say: ['ぴょんぴょん！', 'pyon-pyon!', 'loncat-loncat!'] },
    { id: 'neko', ic: '🐱', name: 'Neko', jp: 'ねこ · kucing', def: 'Neko-chan', price: 80, say: ['にゃー！', 'nyaa!', 'meong!'] },
    { id: 'kuma', ic: '🐻', name: 'Kuma', jp: 'くま · beruang', def: 'Kuma-chan', price: 100, say: ['くまだよ', 'kuma da yo', 'aku beruang lho'] },
    { id: 'kitsune', ic: '🦊', name: 'Kitsune', jp: 'きつね · rubah', def: 'Kitsune-chan', price: 140, say: ['コンコン！', 'kon-kon!', 'suara rubah!'] },
    { id: 'panda', ic: '🐼', name: 'Panda', jp: 'パンダ · panda', def: 'Panda-chan', price: 180, say: ['パンダです', 'panda desu', 'aku panda'] },
  ];

  /* ---------- places ----------
   * scene: [emoji, centre x %, top %, size px, classes] · win = window · rug = carpet · dim = darker at night */
  const ROOMS = [
    { id: 'pink', name: 'Kamar pink', ic: '🌸', win: 1, rug: 1, say: ['ただいま', 'tadaima', 'aku pulang'],
      scene: [['📚 🪴 🍵', 80, 12, 20, 'shelf']] },
    { id: 'matcha', name: 'Taman matcha', ic: '🍵', dim: 1, say: ['みどりが きれい', 'midori ga kirei', 'hijaunya cantik'],
      scene: [['☀️', 50, 4, 26, 'd'], ['☁️', 28, 8, 30, 'drift'], ['🎋', 8, 10, 40, ''], ['🌳', 88, 28, 58, ''], ['🌼', 30, 72, 16, ''], ['🌷', 70, 74, 16, '']] },
    { id: 'starry', name: 'Langit bintang', ic: '🌌', say: ['ほしが きれい', 'hoshi ga kirei', 'bintangnya indah'],
      scene: [['🌙', 84, 8, 34, ''], ['✨', 14, 10, 18, 'tw'], ['⭐', 32, 22, 14, 'tw t2'], ['✨', 62, 6, 14, 'tw t3'], ['🪐', 12, 56, 28, 'float'], ['⭐', 76, 32, 16, 'tw t2']] },
    { id: 'kafe', name: 'Kafe kucing', ic: '☕', price: 60, win: 1, rug: 1, dim: 1, say: ['いらっしゃいませ', 'irasshaimase', 'selamat datang (di toko)'],
      scene: [['☕ 🧁 🍰', 80, 12, 20, 'shelf'], ['🎶', 52, 6, 16, 'float']] },
    { id: 'pantai', name: 'Pantai', ic: '🏖️', price: 90, dim: 1, say: ['うみだ！', 'umi da!', 'ada laut!'],
      scene: [['☀️', 12, 5, 30, 'd'], ['🌙', 12, 5, 26, 'n'], ['⛵', 40, 35, 24, 'drift'], ['🌴', 90, 16, 60, ''], ['🐚', 30, 86, 16, ''], ['🦀', 70, 88, 16, 'walk']] },
    { id: 'salju', name: 'Desa salju', ic: '⛄', price: 90, dim: 1, say: ['ゆきだ！', 'yuki da!', 'ada salju!'],
      scene: [['☁️', 30, 4, 28, 'drift'], ['⛄', 10, 52, 44, ''], ['🌲', 90, 34, 52, ''], ['❄️', 20, 0, 14, 'snow'], ['❄️', 45, 0, 12, 'snow s2'], ['❄️', 70, 0, 16, 'snow s3'], ['❄️', 88, 0, 12, 'snow s4']] },
    { id: 'kuil', name: 'Kuil sakura', ic: '⛩️', price: 110, dim: 1, say: ['おまいり しよう', 'omairi shiyou', 'ayo berdoa di kuil'],
      scene: [['⛩️', 50, 6, 96, ''], ['🌸', 8, 8, 40, ''], ['🌸', 92, 12, 36, ''], ['🏮', 30, 30, 22, 'sway'], ['🏮', 70, 30, 22, 'sway'], ['🦊', 90, 58, 22, '']] },
    { id: 'onsen', name: 'Onsen', ic: '♨️', price: 120, dim: 1, say: ['きもちいい～', 'kimochi ii~', 'enak banget~'],
      scene: [['🏮', 12, 5, 24, 'sway'], ['🏮', 88, 5, 24, 'sway'], ['🎋', 92, 26, 42, ''], ['🐒', 8, 56, 26, ''], ['♨️', 76, 54, 22, ''], ['💨', 32, 52, 20, 'steam'], ['💨', 66, 50, 20, 'steam s2']] },
    { id: 'kota', name: 'Tokyo malam', ic: '🌃', price: 150, say: ['とうきょうの よる', 'toukyou no yoru', 'malam di Tokyo'],
      scene: [['🌙', 52, 4, 24, ''], ['🏙️', 12, 14, 58, ''], ['🗼', 86, 12, 62, ''], ['✨', 34, 10, 14, 'tw'], ['✨', 66, 18, 12, 'tw t2'], ['🏮', 30, 54, 20, 'sway']] },
  ];

  /* ---------- furniture (spot: wall = 1 place, floor = left + right) ---------- */
  const DECOR = [
    { id: 'furin', spot: 'wall', ic: '🎐', name: 'Furin', price: 25, say: ['ふうりん', 'fuurin', 'lonceng angin'] },
    { id: 'chouchin', spot: 'wall', ic: '🏮', name: 'Lentera', price: 30, say: ['ちょうちん', 'chouchin', 'lentera kertas'] },
    { id: 'tokei', spot: 'wall', ic: '🕰️', name: 'Jam', price: 30, say: ['とけい', 'tokei', 'jam'] },
    { id: 'koinobori', spot: 'wall', ic: '🎏', name: 'Koinobori', price: 35, say: ['こいのぼり', 'koinobori', 'bendera ikan koi'] },
    { id: 'e', spot: 'wall', ic: '🖼️', name: 'Lukisan', price: 40, say: ['え', 'e', 'lukisan'] },
    { id: 'shokubutsu', spot: 'floor', ic: '🪴', name: 'Tanaman', price: 20, say: ['しょくぶつ', 'shokubutsu', 'tanaman'] },
    { id: 'nuigurumi', spot: 'floor', ic: '🧸', name: 'Boneka', price: 30, say: ['ぬいぐるみ', 'nuigurumi', 'boneka'] },
    { id: 'kadomatsu', spot: 'floor', ic: '🎍', name: 'Kadomatsu', price: 40, say: ['かどまつ', 'kadomatsu', 'hiasan bambu tahun baru'] },
    { id: 'geemu', spot: 'floor', ic: '🎮', name: 'Konsol game', price: 45, say: ['ゲーム', 'geemu', 'game'] },
    { id: 'terebi', spot: 'floor', ic: '📺', name: 'TV', price: 50, say: ['テレビ', 'terebi', 'televisi'] },
    { id: 'sofa', spot: 'floor', ic: '🛋️', name: 'Sofa', price: 55, say: ['ソファ', 'sofa', 'sofa'] },
    { id: 'suisou', spot: 'floor', ic: '🐠', name: 'Akuarium', price: 60, say: ['すいそう', 'suisou', 'akuarium'] },
    { id: 'hina', spot: 'floor', ic: '🎎', name: 'Boneka hina', price: 70, say: ['ひなにんぎょう', 'hina ningyou', 'boneka festival anak perempuan'] },
  ];

  /* ---------- snacks (bought with coins, fed like carrots) ---------- */
  const SNACKS = [
    { id: 'ichigo', ic: '🍓', name: 'Stroberi', price: 6, full: 10, xp: 12, say: ['いちご あまい！', 'ichigo amai!', 'stroberinya manis!'] },
    { id: 'onigiri', ic: '🍙', name: 'Onigiri', price: 10, full: 30, xp: 15, say: ['おにぎり おいしい！', 'onigiri oishii!', 'onigirinya enak!'] },
    { id: 'dango', ic: '🍡', name: 'Dango', price: 12, full: 15, xp: 25, say: ['だんご だいすき', 'dango daisuki', 'aku suka dango'] },
    { id: 'taiyaki', ic: '🐟', name: 'Taiyaki', price: 14, full: 25, xp: 22, say: ['たいやき あったかい', 'taiyaki attakai', 'taiyakinya hangat'] },
    { id: 'matcha', ic: '🍵', name: 'Teh matcha', price: 15, full: 5, xp: 30, say: ['おちゃ どうぞ', 'ocha douzo', 'silakan tehnya'] },
    { id: 'ramen', ic: '🍜', name: 'Ramen', price: 18, full: 45, xp: 20, say: ['ラーメン さいこう！', 'raamen saikou!', 'ramen terbaik!'] },
    { id: 'cake', ic: '🍰', name: 'Kue stroberi', price: 25, full: 30, xp: 45, say: ['ケーキ しあわせ～', 'keeki shiawase~', 'kue bikin bahagia~'] },
  ];
  const PALETTE = ['#e75b94', '#ff9cc4', '#ff8a3d', '#ffd35c', '#5cc48a', '#4fa3e0', '#8a63f0', '#3b2f46', '#ffffff'];

  const MISSIONS = [
    { id: 'flash', ic: '🃏', name: 'Balik 5 flashcard', goal: 5, go: 'flashcard' },
    { id: 'memory', ic: '🧩', name: 'Menang 1x Memory Match', goal: 1, go: 'memory' },
    { id: 'kanji', ic: '漢', name: 'Tandai 5 kanji "Hafal"', goal: 5, go: 'kanji' },
    { id: 'mochi', ic: '🍡', name: 'Tangkap 15 mochi', goal: 15, go: 'mochi' },
  ];
  const MISSION_REWARD = 2, ALL_BONUS = 3;

  const spById = id => SPECIES.find(x => x.id === id) || SPECIES[0];
  const roomById = id => ROOMS.find(x => x.id === id) || ROOMS[0];
  const decById = id => DECOR.find(x => x.id === id);
  const snackById = id => SNACKS.find(x => x.id === id);

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
    { id: 'fed20', ic: '🥕', name: 'Koki Usagi', desc: 'Kasih makan 20x', goal: 20, get: () => S.fed, reward: { fur: 'choco' } },
    { id: 'rub30', ic: '🤲', name: 'Sayang Usagi', desc: 'Elus 30x', goal: 30, get: () => S.st.rub, reward: { fur: 'sakura' } },
    { id: 'streak3', ic: '📅', name: '3 hari beruntun', desc: 'Belajar 3 hari berturut-turut', goal: 3, get: () => S.st.bestStreak, reward: { item: 'umbrella' } },
    { id: 'streak7', ic: '🌟', name: 'Seminggu rajin', desc: 'Belajar 7 hari berturut-turut', goal: 7, get: () => S.st.bestStreak, reward: { item: 'wand', room: 'starry' } },
    { id: 'mis3', ic: '🎯', name: 'Misi sempurna', desc: 'Beresin semua misi harian di 3 hari', goal: 3, get: () => S.st.misDays, reward: { item: 'halo' } },
    { id: 'lv5', ic: '⭐', name: 'Usagi dewasa', desc: 'Peliharaan sampai Level 5', goal: 5, get: () => level(), reward: { room: 'matcha', carrots: 3 } },
    { id: 'fashion', ic: '👗', name: 'Fashionista', desc: 'Koleksi 10 baju', goal: 10, get: () => ITEMS.filter(owned).length, reward: { fur: 'lavender' } },
    { id: 'snack10', ic: '🍙', name: 'Tukang jajan', desc: 'Kasih 10 camilan', goal: 10, get: () => S.st.snack, reward: { fur: 'orange' } },
    { id: 'zoo', ic: '🐾', name: 'Kebun binatang', desc: 'Punya 3 hewan', goal: 3, get: () => SPECIES.filter(spOwned).length, reward: { fur: 'mint' } },
    { id: 'travel', ic: '🧳', name: 'Jalan-jalan', desc: 'Kunjungi 5 tempat', goal: 5, get: () => S.visited.length, reward: { coins: 30 } },
    { id: 'decor5', ic: '🛋️', name: 'Dekorator', desc: 'Punya 5 dekorasi', goal: 5, get: () => DECOR.filter(decOwned).length, reward: { coins: 40 } },
  ];
  const achForItem = {}, achForFur = {}, achForRoom = {};
  ACH.forEach(a => { if (a.reward.item) achForItem[a.reward.item] = a; if (a.reward.fur) achForFur[a.reward.fur] = a; if (a.reward.room) achForRoom[a.reward.room] = a; });
  const byId = id => ITEMS.find(x => x.id === id);
  const rewardText = r => [r.item && `${byId(r.item).ic} ${byId(r.item).name}`, r.fur && `🎨 Bulu ${FURS.find(f => f.id === r.fur).name}`,
    r.room && `${roomById(r.room).ic} ${roomById(r.room).name}`, r.carrots && `+${r.carrots} 🥕`, r.coins && `+${r.coins} 🪙`].filter(Boolean).join(' · ');

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
    buy: [['かいもの たのしい！', 'kaimono tanoshii!', 'belanja itu seru!'], ['ありがとう！', 'arigatou!', 'makasih!']],
    gift: [['プレゼント！', 'purezento!', 'hadiah!']],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dayStr = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = () => dayStr(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); };

  /* ---------- state ---------- */
  const freshSt = () => ({ flash: 0, kanji: 0, memory: 0, mochi: 0, combo: 0, score: 0, rub: 0, snack: 0, misDays: 0, streak: 0, bestStreak: 0, streakDay: '' });
  const freshDecor = () => ({ wall: null, floorL: null, floorR: null });
  const fresh = () => ({ carrots: 3, full: 60, last: Date.now(), xp: 0, points: 0, fed: 0,
    wear: { ear: 'bow', head: null, face: null, neck: null, body: null, back: null, hand: null }, day: today(), mis: {}, done: {}, bonus: false, seen: [],
    st: freshSt(), ach: {}, colors: {}, fur: 'white', room: 'pink', fresh: [],
    coins: 30, coinInit: false, species: 'usagi', name: 'Usagi-chan', named: false, own: [], decor: freshDecor(), snacks: {}, visited: ['pink'], gift: '' });
  let S;
  try { const raw = JSON.parse(localStorage.getItem(KEY)); S = Object.assign(fresh(), raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}); } catch (_) { S = fresh(); }
  // A damaged save must never turn into NaN / negative numbers that spread through the whole pet.
  { const d = fresh(); ['carrots', 'full', 'xp', 'points', 'fed', 'last'].forEach(k => { if (!Number.isFinite(S[k]) || S[k] < 0) S[k] = d[k]; }); }
  S.full = Math.min(100, S.full); S.carrots = Math.floor(S.carrots);
  if (S.last > Date.now() + 864e5) S.last = Date.now(); // clock was far in the future when saved
  ['mis', 'done', 'ach'].forEach(k => { if (!S[k] || typeof S[k] !== 'object' || Array.isArray(S[k])) S[k] = {}; });
  if (!Array.isArray(S.seen)) S.seen = [];
  if (typeof S.name !== 'string' || !S.name.trim()) { S.name = fresh().name; S.named = false; }
  S.name = S.name.slice(0, 16);
  S.st = Object.assign(freshSt(), S.st && typeof S.st === 'object' ? S.st : {});
  { const d = freshSt(); for (const k in d) if (typeof d[k] === 'number' && !Number.isFinite(S.st[k])) S.st[k] = 0; }
  if (!Array.isArray(S.fresh)) S.fresh = [];
  if (!S.colors || typeof S.colors !== 'object') S.colors = {};
  S.wear = Object.assign(fresh().wear, S.wear || {});
  S.decor = Object.assign(freshDecor(), S.decor || {});
  if (!Array.isArray(S.own)) S.own = [];
  if (!Array.isArray(S.visited)) S.visited = [];
  if (!S.snacks || typeof S.snacks !== 'object') S.snacks = {};
  if (!Number.isFinite(S.coins) || S.coins < 0) S.coins = 0;
  S.coins = Math.floor(S.coins);
  for (const k in S.snacks) if (!Number.isInteger(S.snacks[k]) || S.snacks[k] <= 0) delete S.snacks[k];
  if (!S.visited.includes(S.room)) S.visited.push(S.room);
  if (S.wear.body === 'scarf') { S.wear.body = null; S.wear.neck = 'scarf'; } // scarf moved to its own slot
  // older saves: coins for the study already done, so the shop isn't empty for long-time players
  if (!S.coinInit) { S.coins = 30 + Math.floor(S.points * COINS_PER_POINT) + Object.keys(S.ach).length * ACH_COINS; S.coinInit = true; }
  // older saves: best Tangkap Mochi score counts toward "Jago kana"
  try { ['hira', 'kata', 'mix'].forEach(k => { S.st.score = Math.max(S.st.score, +localStorage.getItem('mochi-best-' + k) || 0); }); } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  function tick() {
    const now = Date.now();
    S.full = Math.max(0, S.full - Math.max(0, now - S.last) / 36e5 * DECAY_PER_HOUR);
    S.last = now;
    if (S.day !== today()) { S.day = today(); S.mis = {}; S.done = {}; S.bonus = false; S.seen = []; }
  }
  const level = () => { let lv = 1; while (S.xp >= xpFor(lv + 1)) lv++; return lv; };
  const owned = it => it.lv ? level() >= it.lv : !!(achForItem[it.id] && S.ach[achForItem[it.id].id]);
  const furOwned = f => achForFur[f.id] ? !!S.ach[achForFur[f.id].id] : f.price ? S.own.includes('fur:' + f.id) : true;
  const roomOwned = r => achForRoom[r.id] ? !!S.ach[achForRoom[r.id].id] : r.price ? S.own.includes('room:' + r.id) : true;
  const spOwned = sp => !sp.price || S.own.includes('sp:' + sp.id);
  const decOwned = d => S.own.includes('dec:' + d.id);
  // a saved choice that is no longer valid falls back to the free default
  if (!spOwned(spById(S.species))) S.species = 'usagi';
  if (!ROOMS.some(r => r.id === S.room)) S.room = 'pink';
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
      <g class="tail tail-neko"><path d="M70 104 Q98 104 92 74" fill="none" stroke-width="9" stroke-linecap="round" style="stroke:var(--fur-line,#f3bcd3)"/><path d="M70 104 Q98 104 92 74" fill="none" stroke-width="5.5" stroke-linecap="round" style="stroke:var(--fur,#fff)"/></g>
      <g class="tail tail-kitsune"><ellipse class="fur" cx="84" cy="92" rx="10" ry="19" transform="rotate(35 84 92)" stroke-width="2"/><ellipse cx="91.5" cy="80" rx="5" ry="7" transform="rotate(35 91.5 80)" fill="#fff"/></g>
      <g class="ears ear-usagi"><g class="pt-ear l"><ellipse class="fur" cx="36" cy="24" rx="10" ry="24" stroke-width="2"/><ellipse class="fur-in" cx="36" cy="26" rx="5" ry="16"/></g>
      <g class="pt-ear r"><ellipse class="fur" cx="64" cy="24" rx="10" ry="24" stroke-width="2"/><ellipse class="fur-in" cx="64" cy="26" rx="5" ry="16"/></g></g>
      <g class="ears ear-neko"><g class="pt-ear l"><path class="fur" d="M24 52 L27 20 L47 38 Z" stroke-width="2" stroke-linejoin="round"/><path class="fur-in" d="M29 45 L30 28 L41 38 Z"/></g><g class="pt-ear r"><path class="fur" d="M76 52 L73 20 L53 38 Z" stroke-width="2" stroke-linejoin="round"/><path class="fur-in" d="M71 45 L70 28 L59 38 Z"/></g></g>
      <g class="ears ear-kuma"><g class="pt-ear l"><circle class="fur" cx="28" cy="42" r="11" stroke-width="2"/><circle class="fur-in" cx="28" cy="42" r="6"/></g><g class="pt-ear r"><circle class="fur" cx="72" cy="42" r="11" stroke-width="2"/><circle class="fur-in" cx="72" cy="42" r="6"/></g></g>
      <g class="ears ear-kitsune"><g class="pt-ear l"><path class="fur" d="M21 56 L24 12 L47 37 Z" stroke-width="2" stroke-linejoin="round"/><path class="fur-in" d="M27 48 L27.5 22 L40 37 Z"/><path d="M24 12 L22.8 30 L31 20 Z" fill="#53364e" opacity=".7"/></g><g class="pt-ear r"><path class="fur" d="M79 56 L76 12 L53 37 Z" stroke-width="2" stroke-linejoin="round"/><path class="fur-in" d="M73 48 L72.5 22 L60 37 Z"/><path d="M76 12 L77.2 30 L69 20 Z" fill="#53364e" opacity=".7"/></g></g>
      <g class="ears ear-panda"><g class="pt-ear l"><circle cx="28" cy="42" r="11" fill="#3b2f46"/></g><g class="pt-ear r"><circle cx="72" cy="42" r="11" fill="#3b2f46"/></g></g>
      <g class="acc acc-halo"><ellipse cx="50" cy="-5" rx="17" ry="4.5" fill="none" stroke-width="3.2" ${KS('halo', '#ffd35c')}/></g>
      <g class="acc acc-bow"><path d="M60 10 l8 -6 l2 9 z M60 10 l-9 -4 l3 9 z" ${K('bow', '#e75b94')}/><circle cx="60" cy="10" r="3" ${KD('bow', '#e75b94')}/></g>
      <ellipse class="fur" cx="24" cy="88" rx="7" ry="10" stroke-width="2"/>
      <ellipse class="fur" cx="76" cy="88" rx="7" ry="10" stroke-width="2"/>
      <ellipse class="fur" cx="50" cy="93" rx="27" ry="15" stroke-width="2"/>
      <g class="acc acc-kimono" clip-path="url(#${c})"><rect x="20" y="76" width="60" height="34" ${K('kimono', '#ff9cc4')}/><circle cx="32" cy="104" r="2.4" fill="#fff" opacity=".8"/><circle cx="68" cy="102" r="2.4" fill="#fff" opacity=".8"/><circle cx="58" cy="106" r="1.8" fill="#fff" opacity=".8"/><rect x="20" y="98" width="60" height="5" ${KD('kimono', '#ff9cc4')}/></g>
      <g class="acc acc-hoodie" clip-path="url(#${c})"><rect x="20" y="76" width="60" height="34" ${K('hoodie', '#8fc8ff')}/><rect x="38" y="99" width="24" height="9" rx="4" ${KD('hoodie', '#8fc8ff')} opacity=".55"/></g>
      <circle class="fur" cx="50" cy="66" r="30" stroke-width="2"/>
      <g class="patch"><ellipse cx="38" cy="65" rx="7.5" ry="9" transform="rotate(20 38 65)" fill="#4a3b52"/><ellipse cx="62" cy="65" rx="7.5" ry="9" transform="rotate(-20 62 65)" fill="#4a3b52"/></g>
      <ellipse class="snout" cx="50" cy="72" rx="9" ry="6.5" fill="#fff" opacity=".6"/>
      <path class="whisk" d="M27 70 l-10 -2 M27 74 l-10 1 M73 70 l10 -2 M73 74 l10 1" stroke="#c9a3b7" stroke-width="1.2" stroke-linecap="round" fill="none"/>
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
  const wearClasses = () => [`sp-${spById(S.species).id}`, ...Object.values(S.wear).filter(Boolean).map(id => 'w-' + id)].join(' ');
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
        S.coins += ACH_COINS + (a.reward.coins || 0);
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
    toast(`🏅 Pencapaian: <b>${a.name}</b>!<small>Hadiah: ${rewardText(a.reward)} · +${ACH_COINS} 🪙${list.length > 1 ? ` · +${list.length - 1} pencapaian lain` : ''}</small>`, 4200);
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
    S.coins += Math.round(gain * COINS_PER_POINT);
    const got = Math.floor(S.points / POINTS_PER_CARROT) - before;
    let msg = '';
    if (got > 0) { S.carrots += got; msg = `+${got} 🥕 dari belajar!`; }
    const m = MISSIONS.find(x => x.id === type);
    if (m && !S.done[m.id]) {
      S.mis[m.id] = (S.mis[m.id] || 0) + 1;
      if (S.mis[m.id] >= m.goal) {
        S.done[m.id] = true; S.carrots += MISSION_REWARD; S.coins += MISSION_COINS;
        msg = `🎯 Misi selesai: ${m.name}! <b>+${MISSION_REWARD} 🥕 +${MISSION_COINS} 🪙</b>`;
        if (!S.bonus && MISSIONS.every(x => S.done[x.id])) {
          S.bonus = true; S.st.misDays++; S.carrots += ALL_BONUS; S.coins += BONUS_COINS;
          msg = `🏆 Semua misi hari ini beres! <b>+${MISSION_REWARD + ALL_BONUS} 🥕 +${MISSION_COINS + BONUS_COINS} 🪙</b>`;
        }
      }
    }
    save();
    const ach = checkAch();
    renderBadge();
    if (visible) render();
    if (ach.length && !inMochi()) return; // the achievement toast wins
    const mission = /^(🎯|🏆)/u.test(msg);
    // During Tangkap Mochi only mission toasts are shown, so the game isn't covered by popups.
    if (msg && (type !== 'mochi' || mission)) toast(mission ? msg : msg + ` <small>${esc(S.name)} nunggu disuapin 🐾</small>`);
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
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let visible = false, built = false, bubbleT, editing = null, lastRub = 0, slotTab = 'all', shopTab = 'sp';
  let sceneFor = null, decorKey = null, armed = null, armT;
  const els = {};
  const SHOP_TABS = [['sp', '🐾 Hewan'], ['room', '🏡 Tempat'], ['dec', '🛋️ Dekorasi'], ['snack', '🍱 Camilan']];
  const SHOP_HINT = {
    sp: 'Ganti hewan kapan saja — level, baju &amp; warna tetap sama.',
    room: 'Pindah tempat buat suasana baru. Tiap tempat ngajarin 1 kata Jepang.',
    dec: 'Dinding muat 1, lantai muat 2 (kiri &amp; kanan). Ketuk dekorasi di ruangan untuk dengar namanya dalam bahasa Jepang.',
    snack: 'Tiap camilan kasih kenyang &amp; XP beda-beda. Suapin lewat tombol camilan di bawah tombol makan.',
  };

  function build() {
    if (built) return; built = true;
    const root = $('pet-root'); if (!root) return;
    root.innerHTML = `
      <div class="pt-grid">
        <div class="pt-main">
          <div class="pt-room-card">
            <div class="pt-top">
              <div class="pt-id"><b class="pt-name" id="pt-name"></b><button type="button" class="pt-rename" id="pt-rename" aria-label="Ganti nama peliharaan" title="Ganti nama">✏️</button><span class="pt-lv" id="pt-lv">Lv 1</span></div>
              <div class="pt-top-r"><span class="pt-coin" title="Koin">🪙 <b id="pt-coins">0</b></span><span class="pt-mood" id="pt-mood"></span></div>
            </div>
            <div class="pt-room" id="pt-room">
              <div class="pt-window" id="pt-window" aria-hidden="true"><span class="pt-sun">☀️</span><span class="pt-moon">🌙</span><i>🌸</i></div>
              <div class="pt-scene" id="pt-scene" aria-hidden="true"></div>
              <div class="pt-rug" id="pt-rug" aria-hidden="true"></div>
              <div class="pt-decor" id="pt-decor"></div>
              <div class="pt-dark" aria-hidden="true"></div>
              <div class="pt-bubble" id="pt-bubble" role="status" aria-live="polite"></div>
              <div class="pt-zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></div>
              <button type="button" class="pt-pet" id="pt-pet" aria-label="Elus"></button>
              <button type="button" class="pt-gift" id="pt-gift" aria-label="Buka hadiah harian" title="Hadiah harian" hidden>🎁</button>
              <div class="pt-fx" id="pt-fx" aria-hidden="true"></div>
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
            <div class="pt-snacks" id="pt-snacks"></div>
            <p class="pt-how">Setiap <b>${POINTS_PER_CARROT} poin belajar</b> = 1 🥕, dan tiap poin = ${COINS_PER_POINT} 🪙. Poin didapat dari balik flashcard, tandai kanji hafal, menang Memory (+5), dan tangkap mochi. <span id="pt-points"></span></p>
          </div>
          <div class="pt-panel pt-shop">
            <div class="pt-ph"><h4>🛍️ Rumah &amp; Toko</h4><small>🪙 <b id="pt-coins2">0</b> koin</small></div>
            <div class="pt-slots" id="pt-shop-tabs" role="tablist" aria-label="Kategori toko"></div>
            <div class="pt-goods" id="pt-goods"></div>
            <p class="pt-hint pt-shop-hint" id="pt-shop-hint"></p>
          </div>
          <div class="pt-panel pt-wardrobe">
            <div class="pt-ph"><h4>👗 Lemari baju</h4><small id="pt-own">0 baju</small></div>
            <div class="pt-slots" id="pt-slots" role="tablist" aria-label="Bagian baju"></div>
            <div class="pt-closet" id="pt-closet"></div>
            <div class="pt-custom" id="pt-custom"></div>
            <div class="pt-row">
              <span class="pt-lab">🎨 Warna bulu</span>
              <div class="pt-sw" id="pt-furs"></div>
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
            <div class="pt-ph"><h4>💬 Kata yang diajarin</h4><small>tiap kamu main</small></div>
            <ul id="pt-words"></ul>
          </div>
        </div>
      </div>`;
    ['pt-lv', 'pt-mood', 'pt-room', 'pt-bubble', 'pt-pet', 'pt-fx', 'pt-full', 'pt-full-t', 'pt-xp', 'pt-xp-t', 'pt-feed', 'pt-rub', 'pt-carrots', 'pt-points',
      'pt-missions', 'pt-bonus', 'pt-closet', 'pt-words', 'pt-slots', 'pt-custom', 'pt-furs', 'pt-own', 'pt-ach', 'pt-ach-n', 'pt-streak',
      'pt-name', 'pt-rename', 'pt-coins', 'pt-coins2', 'pt-window', 'pt-scene', 'pt-rug', 'pt-decor', 'pt-gift', 'pt-snacks',
      'pt-shop-tabs', 'pt-goods', 'pt-shop-hint'].forEach(id => els[id] = $(id));
    els['pt-pet'].innerHTML = svg();
    els['pt-pet'].addEventListener('click', rub);
    els['pt-rub'].addEventListener('click', rub);
    els['pt-feed'].addEventListener('click', () => feed());
    els['pt-rename'].addEventListener('click', rename);
    els['pt-gift'].addEventListener('click', claimGift);
    els['pt-snacks'].addEventListener('click', e => {
      const b = e.target.closest('[data-snack]'); if (b) { feed(b.dataset.snack); return; }
      if (e.target.closest('[data-shop-snack]')) { shopTab = 'snack'; render(); els['pt-goods'].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
    });
    els['pt-decor'].addEventListener('click', e => {
      const b = e.target.closest('[data-dec]'); if (!b) return;
      const d = decById(b.dataset.dec); if (!d) return;
      say(d.say); b.classList.remove('wig'); void b.offsetWidth; b.classList.add('wig');
    });
    els['pt-shop-tabs'].addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { shopTab = b.dataset.tab; disarm(); renderShop(); } });
    els['pt-goods'].addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) shopClick(b.dataset.g); });
    els['pt-slots'].addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { slotTab = b.dataset.slot; renderWardrobe(); } });
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
      if (!furOwned(f)) {
        if (achForFur[f.id]) { const a = achForFur[f.id]; toast(`🔒 Bulu ${f.name}<small>Pencapaian “${a.name}”: ${a.desc}</small>`, 3200); render(); return; }
        if (!buy('fur:' + f.id, f.price, `🎨 Bulu ${f.name}`)) return;
      }
      S.fur = f.id; save(); render(); bounce();
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
  const unfresh = k => { const i = S.fresh.indexOf(k); if (i >= 0) { S.fresh.splice(i, 1); save(); renderBadge(); } };

  /* ---------- name ---------- */
  function rename() {
    const n = els['pt-name'];
    const inp = document.createElement('input');
    inp.className = 'pt-name-in'; inp.maxLength = 16; inp.value = S.name; inp.setAttribute('aria-label', 'Nama peliharaan');
    n.replaceWith(inp); els['pt-rename'].hidden = true; inp.focus(); inp.select();
    let done = false;
    const finish = ok => {
      if (done) return; done = true;
      const v = inp.value.trim().replace(/\s+/g, ' ').slice(0, 16);
      if (ok && v && v !== S.name) { S.name = v; S.named = true; save(); say(['よろしくね！', 'yoroshiku ne!', 'salam kenal ya!']); bounce(); }
      inp.replaceWith(n); els['pt-rename'].hidden = false; render(); renderBadge();
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', () => finish(true));
  }

  /* ---------- shop ---------- */
  function disarm() { armed = null; clearTimeout(armT); }
  /** Two taps to buy: the first one arms the purchase, the second pays. Returns true once bought. */
  function buy(key, price, label) {
    if (S.own.includes(key)) return true;
    if (S.coins < price) {
      disarm(); bounce('nope');
      toast(`🪙 Koin belum cukup untuk ${label}<small>Perlu ${price}, kamu punya ${S.coins}. Belajar &amp; beresin misi buat dapat koin!</small>`, 3200);
      render(); return false;
    }
    if (armed !== key) {
      armed = key; clearTimeout(armT); armT = setTimeout(() => { armed = null; if (visible) render(); }, 4000);
      toast(`Ketuk sekali lagi untuk beli ${label} <b>🪙 ${price}</b>`, 2400);
      render(); return false;
    }
    disarm();
    S.coins -= price; S.own.push(key); save();
    toast(`🛍️ Berhasil beli ${label}! <small>Sisa koin: ${S.coins} 🪙</small>`);
    pop(['🪙', '✨', '🛍️', '💖'], 8);
    checkAch();
    return true;
  }
  function setRoom(r) {
    unfresh('room:' + r.id);
    if (S.room === r.id) { say(r.say); return; }
    S.room = r.id;
    if (!S.visited.includes(r.id)) S.visited.push(r.id);
    save(); render(); bounce(); say(r.say); checkAch();
  }
  function placeDecor(d) {
    const at = Object.keys(S.decor).find(k => S.decor[k] === d.id);
    if (at) { S.decor[at] = null; save(); render(); return; }
    const spots = d.spot === 'wall' ? ['wall'] : ['floorL', 'floorR'];
    const spot = spots.find(k => !S.decor[k]) || spots[spots.length - 1];
    S.decor[spot] = d.id; save(); render(); bounce(); say(d.say);
  }
  function shopClick(g) {
    const [kind, id] = g.split(':');
    if (kind === 'sp') {
      const sp = SPECIES.find(x => x.id === id); if (!sp) return;
      if (!spOwned(sp) && !buy('sp:' + sp.id, sp.price, `${sp.ic} ${sp.name}`)) return;
      if (S.species !== sp.id) {
        const oldDef = spById(S.species).def;
        S.species = sp.id;
        if (!S.named || S.name === oldDef) S.name = sp.def;
        save(); checkAch();
      }
      render(); bounce(); pop([sp.ic, '✨', '💖'], 8); say(sp.say);
    } else if (kind === 'room') {
      const r = ROOMS.find(x => x.id === id); if (!r) return;
      if (!roomOwned(r)) {
        const a = achForRoom[r.id];
        if (a) { toast(`🔒 ${r.ic} ${r.name}<small>Pencapaian “${a.name}”: ${a.desc}</small>`, 3200); return; }
        if (!buy('room:' + r.id, r.price, `${r.ic} ${r.name}`)) return;
      }
      setRoom(r);
    } else if (kind === 'dec') {
      const d = decById(id); if (!d) return;
      if (!decOwned(d) && !buy('dec:' + d.id, d.price, `${d.ic} ${d.name}`)) return;
      placeDecor(d);
    } else if (kind === 'snack') {
      const s = snackById(id); if (!s) return;
      if (S.coins < s.price) { bounce('nope'); toast(`🪙 Koin belum cukup untuk ${s.ic} ${s.name}<small>Perlu ${s.price}, kamu punya ${S.coins}.</small>`, 3000); return; }
      S.coins -= s.price; S.snacks[s.id] = (S.snacks[s.id] || 0) + 1; save();
      toast(`${s.ic} ${s.name} masuk tas! <small>Punya ${S.snacks[s.id]} · sisa ${S.coins} 🪙</small>`, 2000);
      render();
    }
  }

  function claimGift() {
    tick();
    if (S.gift === today()) return;
    S.gift = today(); S.coins += GIFT_COINS; S.carrots += 1; save();
    pop(['🎁', '🪙', '🥕', '✨'], 10); bounce(); say(pick(SAY.gift));
    toast(`🎁 Hadiah harian: <b>+${GIFT_COINS} 🪙 +1 🥕</b><small>Datang lagi besok ya!</small>`);
    render(); renderBadge();
  }

  let heard = [];
  try { heard = JSON.parse(localStorage.getItem('usagi-pet-words')) || []; } catch (_) {}
  if (!Array.isArray(heard)) heard = [];
  function say(p) {
    if (!els['pt-bubble']) return;
    const [jp, ro, id] = p;
    els['pt-bubble'].innerHTML = `<b class="font-jp">${jp}</b><small>${ro}</small><em>= ${id}</em>`;
    els['pt-bubble'].classList.remove('show'); void els['pt-bubble'].offsetWidth; els['pt-bubble'].classList.add('show');
    clearTimeout(bubbleT); bubbleT = setTimeout(() => els['pt-bubble'].classList.remove('show'), 4200);
    if (!heard.some(w => w[0] === jp)) { heard.unshift(p); heard = heard.slice(0, 20); try { localStorage.setItem('usagi-pet-words', JSON.stringify(heard)); } catch (_) {} renderWords(); }
  }
  function renderWords() {
    els['pt-words'].innerHTML = heard.length
      ? heard.map(([jp, ro, id]) => `<li><b class="font-jp">${jp}</b><span>${ro}</span><em>${id}</em></li>`).join('')
      : '<li class="pt-empty">Elus, suapin, atau ajak jalan-jalan — nanti dia ngajarin kata Jepang di sini ♡</li>';
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
    const r = Math.random();
    say(S.full < 35 && r < .6 ? pick(SAY.hungry) : r < .15 ? spById(S.species).say : pick(SAY.pet));
    els['pt-pet'].classList.add('blushy'); setTimeout(() => els['pt-pet'].classList.remove('blushy'), 1500);
    if (Date.now() - lastRub > 1200) { lastRub = Date.now(); S.st.rub++; save(); if (checkAch().length) render(); }
  }
  /** Feed a carrot (no id) or a snack from the bag. */
  function feed(snackId) {
    tick();
    const sn = snackId ? snackById(snackId) : null;
    if (snackId && !sn) return;
    const have = sn ? (S.snacks[sn.id] || 0) : S.carrots;
    if (have <= 0) {
      bounce('nope');
      if (sn) { toast(`${sn.ic} ${sn.name} habis — beli lagi di Toko 🛍️`); render(); return; }
      say(pick(SAY.empty)); toast('Wortelnya habis 🥺 Belajar dulu yuk biar dapat 🥕'); return;
    }
    if (S.full >= 98 && (!sn || sn.full > 5)) { bounce('nope'); say(pick(SAY.full)); return; }
    wokenUntil = Date.now() + 60e3;
    const lvBefore = level();
    if (sn) { S.snacks[sn.id]--; if (!S.snacks[sn.id]) delete S.snacks[sn.id]; S.st.snack++; } else S.carrots--;
    S.full = Math.min(100, S.full + (sn ? sn.full : FEED_FULL)); S.xp += sn ? sn.xp : FEED_XP; S.fed++;
    const lv = level();
    if (lv > lvBefore) S.coins += (lv - lvBefore) * LEVEL_COINS;
    save();
    const c = document.createElement('span'); c.className = 'pt-carrot'; c.textContent = sn ? sn.ic : '🥕'; els['pt-room'].appendChild(c);
    setTimeout(() => c.remove(), 900);
    setTimeout(() => { bounce('eat'); pop(['😋', '💗', '✨', sn ? sn.ic : '🥕'], 5); }, reduce ? 0 : 550);
    if (lv > lvBefore) {
      setTimeout(() => {
        say(pick(SAY.level));
        const it = ITEMS.find(x => x.lv === lv);
        toast(`🎉 ${esc(S.name)} naik ke <b>Level ${lv}</b>! +${LEVEL_COINS} 🪙${it ? `<small>Baju baru: ${it.ic} ${it.name}</small>` : ''}`);
        if (it) { S.wear[it.slot] = it.id; editing = it.id; }
        save(); render(); pop(['🎉', '⭐', '✨', '💖'], 12);
        setTimeout(checkAch, 2700);
      }, 900);
    } else { setTimeout(() => say(sn ? sn.say : pick(SAY.feed)), reduce ? 0 : 550); setTimeout(checkAch, 700); }
    render();
  }

  /* ---------- render ---------- */
  function render() {
    if (!built) return;
    renderStatus();
    renderPanels();
  }
  /** Room, bars and counters — cheap, safe to run every minute (doesn't rebuild buttons that may have focus). */
  function renderStatus() {
    if (!built) return;
    tick();
    const lv = level(), md = mood(), room = roomById(S.room), night = isNight();
    const cur = xpFor(lv), next = xpFor(lv + 1);
    els['pt-lv'].textContent = `Lv ${lv}`;
    els['pt-name'].textContent = S.name;
    els['pt-pet'].setAttribute('aria-label', `Elus ${S.name}`);
    els['pt-mood'].textContent = MOOD_TXT[md];
    els['pt-mood'].dataset.mood = md;
    els['pt-coins'].textContent = S.coins;
    els['pt-coins2'].textContent = S.coins;
    const rm = els['pt-room'];
    rm.dataset.mood = md;
    rm.dataset.room = room.id;
    rm.classList.toggle('night', night);
    rm.classList.toggle('dim', night && !!room.dim);
    if (sceneFor !== room.id) {
      sceneFor = room.id;
      els['pt-scene'].innerHTML = room.scene.map(([t, x, y, sz, c = '']) => `<span class="pt-si ${c}" style="left:${x}%;top:${y}%;font-size:${sz}px">${t}</span>`).join('');
      els['pt-window'].hidden = !room.win;
      els['pt-rug'].hidden = !room.rug;
    }
    const dk = JSON.stringify(S.decor);
    if (decorKey !== dk) {
      decorKey = dk;
      const POS = { wall: 'pos-wall', floorL: 'pos-fl', floorR: 'pos-fr' };
      els['pt-decor'].innerHTML = Object.entries(S.decor).map(([k, id]) => {
        const d = id && decById(id);
        return d && POS[k] ? `<button type="button" class="pt-dec ${POS[k]}" data-dec="${d.id}" aria-label="${d.name} — dengar kata Jepangnya" title="${d.name}">${d.ic}</button>` : '';
      }).join('');
    }
    els['pt-gift'].hidden = S.gift === today();
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
  }
  function renderPanels() {
    els['pt-missions'].innerHTML = MISSIONS.map(m => {
      const n = Math.min(m.goal, S.mis[m.id] || 0), done = !!S.done[m.id];
      return `<li class="${done ? 'done' : ''}"><span class="pt-mi ${m.id === 'kanji' ? 'font-jp' : ''}">${done ? '✓' : m.ic}</span>
        <div><b>${m.name}</b><div class="pt-track sm"><i style="width:${n / m.goal * 100}%"></i></div></div>
        ${done ? `<span class="pt-got">+${MISSION_REWARD} 🥕</span>` : `<button type="button" data-go="${m.go}">${n}/${m.goal} →</button>`}</li>`;
    }).join('');
    els['pt-bonus'].innerHTML = S.bonus ? `🏆 Semua misi beres! Bonus <b>+${ALL_BONUS} 🥕 +${BONUS_COINS} 🪙</b> sudah masuk.` : `Selesaikan semua misi untuk bonus <b>+${ALL_BONUS} 🥕 +${BONUS_COINS} 🪙</b>`;
    renderSnacks();
    renderShop();
    renderWardrobe();
    renderAch();
  }

  function renderSnacks() {
    const bag = SNACKS.filter(s => S.snacks[s.id] > 0);
    els['pt-snacks'].innerHTML = bag.length
      ? `<span class="pt-lab">🍱 Camilan</span>${bag.map(s => `<button type="button" data-snack="${s.id}" title="${s.name}: +${s.full}% kenyang, +${s.xp} XP" aria-label="Suapin ${s.name} (punya ${S.snacks[s.id]})">${s.ic}<em>${S.snacks[s.id]}</em></button>`).join('')}`
      : `<span class="pt-hint">🍱 Belum ada camilan. <button type="button" class="pt-link" data-shop-snack>Beli di toko →</button></span>`;
  }

  function renderShop() {
    els['pt-shop-tabs'].innerHTML = SHOP_TABS.map(([k, n]) => {
      const dot = k === 'room' && ROOMS.some(r => S.fresh.includes('room:' + r.id));
      return `<button type="button" role="tab" data-tab="${k}" aria-selected="${shopTab === k}" class="${shopTab === k ? 'on' : ''}">${n}${dot ? '<i></i>' : ''}</button>`;
    }).join('');
    const price = (key, p) => armed === key ? `<span class="pt-price armed">Beli? 🪙 ${p}</span>` : `<span class="pt-price ${S.coins < p ? 'cant' : ''}">🪙 ${p}</span>`;
    const card = (g, ic, name, sub, foot, cls = '', extra = '') =>
      `<button type="button" data-g="${g}" class="${cls}" ${cls.includes('on') ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${extra}<span class="pt-gi">${ic}</span><b>${name}</b>${sub ? `<small class="font-jp">${sub}</small>` : ''}${foot}</button>`;
    let html = '';
    if (shopTab === 'sp') {
      html = SPECIES.map(sp => {
        const has = spOwned(sp), on = S.species === sp.id;
        return card('sp:' + sp.id, sp.ic, sp.name, sp.jp, on ? '<span class="pt-state">✓ Dipakai</span>' : has ? '<span class="pt-state go">Pakai</span>' : price('sp:' + sp.id, sp.price), on ? 'on' : has ? '' : 'locked');
      }).join('');
    } else if (shopTab === 'room') {
      html = ROOMS.map(r => {
        const has = roomOwned(r), on = S.room === r.id, a = achForRoom[r.id], isNew = S.fresh.includes('room:' + r.id);
        const foot = on ? '<span class="pt-state">✓ Di sini</span>' : has ? '<span class="pt-state go">Pergi</span>'
          : a ? `<span class="pt-price">🏅 ${a.name}</span>` : price('room:' + r.id, r.price);
        return card('room:' + r.id, r.ic, r.name, r.say[0], foot, `${on ? 'on' : has ? '' : 'locked'} rm-${r.id}`, isNew && has ? '<em class="pt-new">BARU</em>' : '');
      }).join('');
    } else if (shopTab === 'dec') {
      html = DECOR.map(d => {
        const has = decOwned(d), on = Object.values(S.decor).includes(d.id);
        const foot = on ? '<span class="pt-state">✓ Dipasang</span>' : has ? '<span class="pt-state go">Pasang</span>' : price('dec:' + d.id, d.price);
        return card('dec:' + d.id, d.ic, d.name, `${d.say[0]} · ${d.spot === 'wall' ? 'dinding' : 'lantai'}`, foot, on ? 'on' : has ? '' : 'locked');
      }).join('');
    } else {
      html = SNACKS.map(s => {
        const n = S.snacks[s.id] || 0;
        return card('snack:' + s.id, s.ic, s.name, `+${s.full}% kenyang · +${s.xp} XP`, `<span class="pt-price ${S.coins < s.price ? 'cant' : ''}">🪙 ${s.price}${n ? ` · punya ${n}` : ''}</span>`, '');
      }).join('');
    }
    els['pt-goods'].innerHTML = html;
    els['pt-shop-hint'].innerHTML = `${SHOP_HINT[shopTab]} <span>Dapat 🪙 dari belajar, misi harian, naik level, pencapaian &amp; hadiah harian 🎁.</span>`;
  }

  function renderWardrobe() {
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

    // colour customiser for what the pet is wearing
    const worn = Object.values(S.wear).filter(Boolean).map(byId).filter(Boolean);
    if (!worn.some(w => w.id === editing)) editing = worn[0] ? worn[0].id : null;
    if (!worn.length) {
      els['pt-custom'].innerHTML = '<p class="pt-hint">🎨 Pakaikan baju dulu, lalu ganti warnanya di sini.</p>';
    } else {
      const ed = byId(editing), cur = (S.colors[editing] || ed.color).toLowerCase();
      els['pt-custom'].innerHTML = `
        <div class="pt-row"><span class="pt-lab">🎨 Warnai</span>
          <div class="pt-chips">${worn.map(w => `<button type="button" data-edit="${w.id}" class="${w.id === editing ? 'on' : ''}" aria-pressed="${w.id === editing}">${w.ic} ${w.name}</button>`).join('')}</div></div>
        <div class="pt-sw" aria-label="Warna ${ed.name}">
          ${PALETTE.map(c => `<button type="button" data-color="${c}" class="${cur === c ? 'on' : ''}" aria-pressed="${cur === c}" style="--sw:${c}" aria-label="Warna ${c}"></button>`).join('')}
          <button type="button" data-color="reset" class="pt-reset" title="Warna asli" style="--sw:${ed.color}" aria-label="Warna asli">↺</button>
        </div>`;
    }
    els['pt-furs'].innerHTML = FURS.map(f => {
      const has = furOwned(f), on = S.fur === f.id, isNew = S.fresh.includes('fur:' + f.id), key = 'fur:' + f.id;
      const why = achForFur[f.id] ? 'Terkunci: ' + achForFur[f.id].name : `Beli 🪙 ${f.price}`;
      const mark = has ? (isNew ? '<em class="pt-dot"></em>' : '') : armed === key ? '🪙' : achForFur[f.id] ? '🔒' : '<b class="pt-swp">🪙</b>';
      return `<button type="button" data-fur="${f.id}" class="${on ? 'on' : ''} ${has ? '' : 'locked'} ${armed === key ? 'armed' : ''}" aria-pressed="${on}" style="--sw:${f.c};--swl:${f.l}" title="${has ? f.name : f.name + ' — ' + why}" aria-label="Bulu ${f.name}${has ? '' : ' (' + why + ')'}">${mark}</button>`;
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
    const b = $('pet-badge'), hungry = S.full < 35, gifts = S.fresh.length || S.gift !== today();
    if (b) { b.hidden = !(S.carrots > 0 || hungry || gifts); b.textContent = hungry ? '!' : gifts ? '🎁' : S.carrots; b.classList.toggle('alert', hungry); }
    const h = $('hc-pet-status');
    if (h) h.textContent = `${spById(S.species).ic} ${S.name} • Lv ${level()} • ${MOOD_TXT[mood()]} • ${S.carrots} 🥕 • ${S.coins} 🪙`;
  }

  let clock;
  function show() {
    build(); visible = true; renderWords(); render();
    const md = mood();
    setTimeout(() => say(md === 'sleep' ? pick(SAY.sleep) : md === 'hungry' || md === 'starving' ? pick(SAY.hungry) : Math.random() < .3 ? spById(S.species).say : pick(SAY.hello)), 350);
    clearInterval(clock); clock = setInterval(renderStatus, 60e3);
    if (pending.length) { const p = pending; pending = []; setTimeout(() => announce(p), 600); }
  }
  function hide() { visible = false; clearInterval(clock); disarm(); }

  tick();
  checkAch(); // grant achievements earned before this feature existed (level, best score…)
  save();
  const ready = () => { renderBadge(); setInterval(renderBadge, 5 * 60e3); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

  window.UsagiPet = { study, svg, dress, show, hide, wearClasses, wearStyle, toast, mochiEnd };
})();
