/* Kanji Flashcards ♡ — depan kanji, belakang hiragana + arti */
(() => {
    const DATA = window.KANJI_DATA || [];
    if (!DATA.length) return;

    const $ = id => document.getElementById(id);
    const els = {
        section: $('mode-kanji'), pack: $('kj-pack'), customBox: $('kj-custom'), from: $('kj-from'), to: $('kj-to'), apply: $('kj-apply'), customHint: $('kj-custom-hint'), customBtn: $('kj-custom-btn'), customClose: $('kj-custom-close'), onlyUnknown: $('kj-only-unknown'), shuffle: $('kj-shuffle'), reset: $('kj-reset'),
        ring: $('kj-ring'), ringPct: $('kj-ring-pct'), knownLabel: $('kj-known-label'), cheer: $('kj-cheer'), combo: $('kj-combo'),
        card: $('kj-card'), inner: $('kj-inner'), num: $('kj-num'), numB: $('kj-num-b'), knownTag: $('kj-known-tag'),
        kanji: $('kj-kanji'), sticker: $('kj-sticker'), reading: $('kj-reading'), meaning: $('kj-meaning'), mini: $('kj-mini-kanji'),
        speak: $('kj-speak'), stamp: $('kj-stamp'), prev: $('kj-prev'), next: $('kj-next'), yes: $('kj-yes'), nope: $('kj-nope'),
        counter: $('kj-counter'), empty: $('kj-empty')
    };

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const OUT_MS = reduce ? 20 : 130, IN_MS = reduce ? 20 : 220;
    const cardText = i => DATA[i][0] + DATA[i][1];
    const jpf = window.jpFont;
    const say = (t, ms) => window.cuteSay && window.cuteSay(t, ms);
    const happy = () => window.cuteHappy && window.cuteHappy();
    const popAt = (el, n, set) => window.cutePopAt && window.cutePopAt(el, n, set);
    const pick = a => a[Math.floor(Math.random() * a.length)];

    const STICKERS = ['🐰', '🐱', '🐥', '🍓', '🍡', '🧸', '🌷', '🍰', '🐹', '🎀', '🐧', '🍑', '🌸', '🐶', '🍙', '⭐'];
    const PACK_ICONS = ['🍓', '🍡', '🌸', '🧸', '🍰', '🐰', '🎀', '🍑', '🐱', '🌷', '🍙', '⭐', '💗'];
    const YAY = ['Pinter banget! 💗', 'Sugoi~ すごい! ✨', 'Hanamaru! 💮', 'Yatta! やった! 🎉', 'Kamu jenius ya? 🥹', 'Mantap sayang! 🫶'];
    const OOPS = ['Gapapa, nanti ketemu lagi 🌷', 'Pelan-pelan aja ya 🐢💗', 'Daijoubu~ 大丈夫 🥺', 'Nanti pasti hafal kok! 💪'];
    const CHEERS = [
        [0, 'Ayo mulai, pasti bisa! 🌷'], [1, 'Langkah pertama! Hebat 🐣'], [25, 'Udah seperempat jalan~ 🍡'],
        [50, 'Setengah jalan! Semangat! 💪'], [75, 'Dikit lagi, sayang! 🔥'], [100, 'Sempurna! Kamu luar biasa 🏆💗']
    ];

    // Paket of 50 (sisa kecil digabung ke paket terakhir)
    const SIZE = 50;
    const packs = [];
    for (let i = 0; i < DATA.length; i += SIZE) packs.push([i, Math.min(i + SIZE, DATA.length)]);
    if (packs.length > 1 && packs[packs.length - 1][1] - packs[packs.length - 1][0] < 20) {
        const last = packs.pop(); packs[packs.length - 1][1] = last[1];
    }

    const keyOf = i => DATA[i][0] + '|' + DATA[i][1];
    let known;
    try { known = new Set(JSON.parse(localStorage.getItem('kj-known') || '[]')); } catch (_) { known = new Set(); }
    const saveKnown = () => { try { localStorage.setItem('kj-known', JSON.stringify([...known])); } catch (_) {} };

    const N = DATA.length;
    const clampNo = v => Math.min(N, Math.max(1, parseInt(v, 10) || 1));
    let custom = [1, Math.min(N, SIZE)];
    try {
        const c = JSON.parse(localStorage.getItem('kj-custom') || 'null');
        if (Array.isArray(c) && c.length === 2) { const a = clampNo(c[0]), b = clampNo(c[1]); custom = [Math.min(a, b), Math.max(a, b)]; }
    } catch (_) {}

    let packIdx = 0;
    try { packIdx = parseInt(localStorage.getItem('kj-pack') || '0', 10); } catch (_) {}
    if (!(packIdx >= -2 && packIdx < packs.length)) packIdx = 0;
    let onlyUnknown = false;
    let order = [], pos = 0, flipped = false, busy = false, combo = 0;
    let queued = false; // an answer button already scheduled the next card

    function packRange() {
        if (packIdx === -1) return [0, N];
        if (packIdx === -2) return [custom[0] - 1, custom[1]];
        return packs[packIdx];
    }
    const customLabel = () => `✏️ No. ${custom[0]}–${custom[1]}`;
    // Tombol Custom: pink + tulisan rentang kalau mode custom aktif
    function syncCustomUI() {
        const on = packIdx === -2;
        els.customBtn.classList.toggle('active', on);
        els.customBtn.textContent = on ? customLabel() : '✏️ Custom';
        let opt = els.pack.querySelector('option[value="-2"]');
        if (on) {
            if (!opt) { opt = document.createElement('option'); opt.value = '-2'; opt.hidden = true; els.pack.appendChild(opt); }
            opt.textContent = customLabel();
            els.pack.value = '-2';
        } else if (opt) opt.remove();
    }
    function updateHint() {
        const a = parseInt(els.from.value, 10), b = parseInt(els.to.value, 10);
        if (!(a >= 1) || !(b >= 1)) { els.customHint.textContent = `Isi nomor 1–${N} ya~ 🌷`; return; }
        let x = clampNo(a), y = clampNo(b);
        if (x > y) [x, y] = [y, x];
        els.customHint.textContent = `💗 ${y - x + 1} kanji dipilih (no. ${x}–${y}) · tersedia no. 1–${N}`;
    }
    function openCustom() {
        const [a, b] = packRange();
        els.from.max = els.to.max = N;
        els.from.value = a + 1; els.to.value = b;
        updateHint();
        els.customBox.hidden = false;
        els.customBtn.setAttribute('aria-expanded', 'true');
        setTimeout(() => { els.from.focus(); els.from.select(); }, 30);
    }
    function closeCustom() {
        els.customBox.hidden = true;
        els.customBtn.setAttribute('aria-expanded', 'false');
    }
    function packIndices() { const [a, b] = packRange(); return Array.from({ length: b - a }, (_, k) => a + k); }

    function buildPackOptions() {
        const opts = packs.map(([a, b], i) => `<option value="${i}">${PACK_ICONS[i % PACK_ICONS.length]} Paket ${i + 1} (no. ${a + 1}–${b})</option>`);
        opts.push(`<option value="-1">💝 Semua kanji (${DATA.length})</option>`);
        els.pack.innerHTML = opts.join('');
        els.pack.value = String(packIdx);
        syncCustomUI();
    }

    function rebuildOrder(keepShuffle) {
        let list = packIndices();
        if (onlyUnknown) list = list.filter(i => !known.has(keyOf(i)));
        if (keepShuffle) {
            for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
        }
        order = list;
        pos = 0;
    }

    function fitSize(text) {
        const n = [...text].length;
        const [rem, vw] = n <= 1 ? [6.5, 30] : n === 2 ? [5, 22] : n === 3 ? [3.9, 16] : n === 4 ? [3.2, 13] : n <= 6 ? [2.5, 10] : n <= 9 ? [1.9, 7.5] : [1.5, 5.8];
        return `min(${rem}rem, ${vw}vw)`;
    }

    function setFlip(v, instant) {
        flipped = v;
        if (instant) { els.inner.classList.add('no-anim'); }
        els.card.classList.toggle('flipped', v);
        els.card.setAttribute('aria-label', v ? 'Jawaban kanji, tekan untuk kembali' : 'Kartu kanji, tekan untuk membalik');
        if (instant) { void els.inner.offsetWidth; els.inner.classList.remove('no-anim'); }
    }

    function render() {
        const empty = order.length === 0;
        els.section.classList.toggle('is-empty', empty);
        els.empty.hidden = !empty;
        updateStats();
        if (empty) return;
        const i = order[pos];
        const [k, r, m] = DATA[i];
        els.kanji.textContent = k;
        els.kanji.style.setProperty('--kjs', fitSize(k));
        els.mini.textContent = k;
        els.reading.textContent = r;
        els.meaning.textContent = m;
        els.num.textContent = els.numB.textContent = '#' + (i + 1);
        els.sticker.textContent = STICKERS[i % STICKERS.length];
        els.knownTag.classList.toggle('on', known.has(keyOf(i)));
        els.counter.textContent = `${pos + 1} / ${order.length}`;
        if (jpf) {
            jpf.wait([els.kanji, els.reading, els.mini], k + r);
            const n = order.length;
            jpf.prefetch([1, 2, 3, 4, -1, -2].map(d => cardText(order[(pos + d + n * 4) % n])));
        }
    }

    function updateStats() {
        const list = packIndices();
        const done = list.filter(i => known.has(keyOf(i))).length;
        const pct = list.length ? Math.round(done / list.length * 100) : 0;
        els.ring.style.setProperty('--p', pct);
        els.ringPct.textContent = pct + '%';
        els.knownLabel.textContent = `${done} / ${list.length} hafal 💮`;
        let cheer = CHEERS[0][1];
        CHEERS.forEach(([t, s]) => { if ((t === 1 ? done >= 1 : pct >= t)) cheer = s; });
        els.cheer.textContent = cheer;
    }

    // Light swap: slide out → swap content (instantly unflipped) → slide in
    function go(dir) {
        if (busy || queued || order.length === 0) return;
        if (order.length === 1 && dir !== 0) { wiggle(); return; }
        busy = true;
        const outCls = dir >= 0 ? 'out-l' : 'out-r', inCls = dir >= 0 ? 'in-l' : 'in-r';
        const n = order.length;
        if (jpf) jpf.load(cardText(order[(pos + (dir > 0 ? 1 : dir < 0 ? -1 : 0) + n) % n]));
        const my = ++animToken;
        els.card.classList.remove('in-l', 'in-r');
        const swap = () => {
            els.card.classList.remove('out-l', 'out-r');
            els.card.style.transform = '';
            setFlip(false, true);
            if (dir > 0) pos = (pos + 1) % order.length;
            else if (dir < 0) pos = (pos - 1 + order.length) % order.length;
            if (pos >= order.length) pos = 0;
            render();
            if (order.length === 0) { busy = false; return; }
            els.card.classList.add(inCls);
            // allow the next swipe right away; just clean up the class later
            busy = false;
            setTimeout(() => { if (my === animToken) els.card.classList.remove(inCls); }, IN_MS + 20);
        };
        els.card.classList.add(outCls);
        setTimeout(swap, OUT_MS);
    }

    let animToken = 0;
    function wiggle() {
        els.card.classList.remove('wiggle'); void els.card.offsetWidth; els.card.classList.add('wiggle');
        setTimeout(() => els.card.classList.remove('wiggle'), 420);
    }

    function flip() {
        if (busy || queued || order.length === 0) return;
        setFlip(!flipped);
        if (flipped) popAt(els.card, 6, ['✨', '💫', '🌸', '⭐']);
    }

    function showCombo() {
        if (combo >= 3) {
            els.combo.textContent = `combo x${combo} ${combo >= 10 ? '👑' : combo >= 6 ? '🔥' : '💗'}`;
            els.combo.classList.add('show');
        } else {
            els.combo.classList.remove('show');
        }
    }

    function markYes() {
        if (busy || queued || order.length === 0) return;
        queued = true;
        const deck = order; // if the pack/shuffle changes meanwhile, don't advance
        const i = order[pos];
        const wasKnown = known.has(keyOf(i));
        known.add(keyOf(i)); saveKnown();
        if (!wasKnown && window.UsagiPet) window.UsagiPet.study('kanji', keyOf(i));
        combo++; showCombo();
        els.knownTag.classList.add('on');
        els.stamp.classList.remove('show'); void els.stamp.offsetWidth; els.stamp.classList.add('show');
        popAt(els.yes, 9, ['💗', '💖', '💕', '💮', '✨']);
        updateStats();

        const list = packIndices();
        const done = list.filter(j => known.has(keyOf(j))).length;
        if (!wasKnown && done === list.length) {
            happy(); say('Paket ini udah hafal semua!! 🏆💗 Aku bangga banget sama kamu~', 4200);
            if (typeof window.showerConfetti === 'function') window.showerConfetti();
        } else if (combo > 0 && combo % 5 === 0) {
            happy(); say(`Combo ${combo}! ${pick(YAY)}`, 2200);
        } else if (Math.random() < .25) {
            say(pick(YAY), 1600);
        }

        setTimeout(() => {
            queued = false;
            if (order !== deck) return;
            if (onlyUnknown) {
                // remove from queue, show the next one in its place
                busy = true;
                const my = ++animToken;
                els.card.classList.remove('in-l', 'in-r');
                els.card.classList.add('out-l');
                setTimeout(() => {
                    order.splice(pos, 1);
                    if (pos >= order.length) pos = 0;
                    els.card.classList.remove('out-l');
                    setFlip(false, true);
                    render();
                    if (order.length) {
                        els.card.classList.add('in-l');
                        setTimeout(() => { if (my === animToken) els.card.classList.remove('in-l'); }, IN_MS + 20);
                    }
                    busy = false;
                }, OUT_MS);
            } else {
                go(1);
            }
        }, reduce ? 150 : 420);
    }

    function markNope() {
        if (busy || queued || order.length === 0) return;
        queued = true;
        const deck = order; // if the pack/shuffle changes meanwhile, don't advance
        const i = order[pos];
        if (known.delete(keyOf(i))) saveKnown();
        combo = 0; showCombo();
        els.knownTag.classList.remove('on');
        updateStats();
        wiggle();
        if (Math.random() < .4) say(pick(OOPS), 1800);
        setTimeout(() => { queued = false; if (order === deck) go(1); }, reduce ? 100 : 300);
    }

    function speak(e) {
        if (e) e.stopPropagation();
        if (!('speechSynthesis' in window) || order.length === 0) return;
        const r = DATA[order[pos]][1].split(/[、／（(]/)[0].replace(/～/g, '').trim();
        const u = new SpeechSynthesisUtterance(r || DATA[order[pos]][0]);
        u.lang = 'ja-JP'; u.rate = 0.85;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
        popAt(els.speak, 5, ['🎵', '🎶', '💗']);
    }

    // Swipe / tap handling
    let startX = 0, startY = 0, dx = 0, dragging = false, pressed = false;
    let lastX = 0, lastT = 0, vx = 0; // px per ms, for quick flicks
    els.card.addEventListener('pointerdown', e => {
        if (e.target.closest('.kj-speak') || busy) return;
        pressed = true; dragging = false; startX = e.clientX; startY = e.clientY; dx = 0;
        lastX = e.clientX; lastT = performance.now(); vx = 0;
    });
    els.card.addEventListener('pointermove', e => {
        if (!pressed) return;
        dx = e.clientX - startX;
        const t = performance.now(), dt = t - lastT;
        if (dt > 0) { vx = vx * 0.3 + ((e.clientX - lastX) / dt) * 0.7; lastX = e.clientX; lastT = t; }
        if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - startY)) {
            dragging = true;
            try { els.card.setPointerCapture(e.pointerId); } catch (_) {}
        }
        if (dragging) els.card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    });
    const endPress = () => {
        if (!pressed) return;
        pressed = false;
        if (dragging) {
            dragging = false;
            const stale = (performance.now() - lastT) > 120;
            const flick = !stale && Math.abs(vx) > 0.35 && Math.abs(dx) > 24 && Math.sign(vx) === Math.sign(dx);
            if (Math.abs(dx) > 55 || flick) { go(dx < 0 ? 1 : -1); }
            else {
                els.card.style.transition = 'transform .25s cubic-bezier(.3,1.5,.5,1)';
                els.card.style.transform = '';
                setTimeout(() => { els.card.style.transition = ''; }, 260);
            }
        } else {
            flip();
        }
    };
    els.card.addEventListener('pointerup', endPress);
    els.card.addEventListener('pointercancel', () => { pressed = false; dragging = false; els.card.style.transform = ''; });
    els.card.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); flip(); } });

    document.addEventListener('keydown', e => {
        if (typeof currentMode === 'undefined' || currentMode !== 'kanji') return;
        if (e.target.closest && e.target.closest('select, input, textarea')) return;
        if (e.key === 'ArrowRight') go(1);
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); flip(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); markYes(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); markNope(); }
    });

    els.speak.addEventListener('click', speak);
    els.speak.addEventListener('pointerdown', e => e.stopPropagation());
    els.prev.addEventListener('click', () => go(-1));
    els.next.addEventListener('click', () => go(1));
    els.yes.addEventListener('click', markYes);
    els.nope.addEventListener('click', markNope);
    els.pack.addEventListener('change', () => {
        packIdx = parseInt(els.pack.value, 10);
        try { localStorage.setItem('kj-pack', String(packIdx)); } catch (_) {}
        syncCustomUI(); closeCustom();
        combo = 0; showCombo();
        rebuildOrder(false); setFlip(false, true); render();
        say(`${els.pack.options[els.pack.selectedIndex].text.split(' (')[0]} siap! Ganbatte~ 💪`, 2000);
    });
    function applyCustom() {
        let a = clampNo(els.from.value), b = clampNo(els.to.value);
        if (a > b) [a, b] = [b, a];
        custom = [a, b];
        packIdx = -2;
        try { localStorage.setItem('kj-custom', JSON.stringify(custom)); localStorage.setItem('kj-pack', '-2'); } catch (_) {}
        syncCustomUI(); closeCustom();
        combo = 0; showCombo();
        rebuildOrder(false); setFlip(false, true); render();
        popAt(els.customBtn, 6, ['✏️', '✨', '💗']);
        say(`Kanji no. ${a}–${b} siap! (${b - a + 1} kartu) Ganbatte~ 💪`, 2200);
    }
    els.apply.addEventListener('click', applyCustom);
    els.customBtn.addEventListener('click', () => { if (els.customBox.hidden) openCustom(); else closeCustom(); });
    els.customClose.addEventListener('click', () => { closeCustom(); els.customBtn.focus(); });
    [els.from, els.to].forEach(inp => {
        inp.addEventListener('input', updateHint);
        inp.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); applyCustom(); }
            else if (e.key === 'Escape') { e.preventDefault(); closeCustom(); els.customBtn.focus(); }
        });
    });
    els.onlyUnknown.addEventListener('click', () => {
        onlyUnknown = !onlyUnknown;
        els.onlyUnknown.setAttribute('aria-pressed', String(onlyUnknown));
        rebuildOrder(false); setFlip(false, true); render();
    });
    els.shuffle.addEventListener('click', () => {
        rebuildOrder(true); setFlip(false, true); render();
        els.card.classList.add('in-l'); setTimeout(() => els.card.classList.remove('in-l'), IN_MS + 20);
        popAt(els.shuffle, 6, ['🔀', '✨', '🎲']);
    });
    els.reset.addEventListener('click', () => {
        if (!confirm('Hapus tanda "hafal" di paket ini? 🥺')) return;
        packIndices().forEach(i => known.delete(keyOf(i)));
        saveKnown(); combo = 0; showCombo();
        rebuildOrder(false); setFlip(false, true); render();
    });

    buildPackOptions();
    rebuildOrder(false);
    render();

    let greeted = false;
    window.KanjiDeck = {
        show() {
            document.body.classList.add('kj-seen');
            try { localStorage.setItem('kj-seen', '1'); } catch (_) {}
            if (!greeted) { greeted = true; setTimeout(() => { happy(); say('Yuk hafalin kanji bareng aku! 漢字 🐰💕', 2800); }, 300); }
        }
    };
    try { if (localStorage.getItem('kj-seen')) document.body.classList.add('kj-seen'); } catch (_) {}
})();
