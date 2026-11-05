/* Japanese font helper ♡
 * Google Fonts serves Zen Maru Gothic in many small pieces (one per group of
 * characters). A new kanji can need a piece that hasn't downloaded yet, so the
 * browser first draws a thin fallback font and then swaps to the bold one.
 * This helper loads the needed pieces ahead of time and lets the cards hide
 * the text for a moment until the real font is ready, so it never "jumps".
 */
(() => {
    const FAMILY = '"Zen Maru Gothic"';
    const WEIGHTS = [700, 500];
    const MAX_WAIT = 900; // ms — never hide text longer than this
    const hasFonts = !!(document.fonts && document.fonts.load && document.fonts.check);

    // The Google Fonts stylesheet loads lazily (media="print" → "all").
    let sheetReady = false;
    const sheetPromise = new Promise(resolve => {
        const done = () => { sheetReady = true; resolve(); };
        const find = () => document.querySelector('link[href*="Zen+Maru+Gothic"]');
        const hook = link => {
            if (!link) return done();
            if (link.media === 'all' && link.sheet) return done();
            link.addEventListener('load', () => setTimeout(done, 0), { once: true });
            link.addEventListener('error', done, { once: true });
        };
        const link = find();
        if (link) hook(link);
        else document.addEventListener('DOMContentLoaded', () => hook(find()), { once: true });
        setTimeout(done, 4000);
    });

    const cache = new Map();
    function load(text) {
        if (!hasFonts || !text) return Promise.resolve();
        const key = String(text);
        if (cache.has(key)) return cache.get(key);
        const p = sheetPromise
            .then(() => Promise.all(WEIGHTS.map(w => document.fonts.load(`${w} 32px ${FAMILY}`, key).catch(() => {}))))
            .then(() => {});
        cache.set(key, p);
        if (cache.size > 400) cache.delete(cache.keys().next().value);
        return p;
    }

    function isReady(text) {
        if (!hasFonts || !text) return true;
        if (!sheetReady) return false;
        try { return WEIGHTS.every(w => document.fonts.check(`${w} 32px ${FAMILY}`, String(text))); } catch (_) { return true; }
    }

    // Each element keeps its own ticket, so the regular flashcards and the
    // kanji deck never cancel each other's "show again" step.
    const tickets = new WeakMap();
    let seq = 0;
    // Hide the given elements until the font for `text` is ready (max MAX_WAIT ms).
    function wait(elems, text) {
        const list = elems.filter(Boolean);
        if (!list.length) return;
        if (isReady(text)) { list.forEach(el => { tickets.delete(el); el.classList.remove('jp-wait'); }); return; }
        const my = ++seq;
        list.forEach(el => { tickets.set(el, my); el.classList.add('jp-wait'); });
        let shown = false;
        const show = () => {
            if (shown) return; shown = true;
            list.forEach(el => { if (tickets.get(el) === my) { tickets.delete(el); el.classList.remove('jp-wait'); } });
        };
        load(text).then(show, show);
        setTimeout(show, MAX_WAIT);
    }

    window.jpFont = { load, isReady, wait, prefetch: texts => texts.forEach(t => load(t)) };
})();
