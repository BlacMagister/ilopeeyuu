/* ============ Duel Kanji — realtime multiplayer ⚔️ ============
 * Server (/api/duel/*) owns the game clock. This client polls the room state,
 * measures its offset to the server clock, and renders every phase in sync.
 */
(() => {
    const root = document.getElementById('duel-root');
    if (!root) return;

    const API = '/api/duel/';
    const AVATARS = ['🐰', '🐱', '🐻', '🐼', '🦊', '🐸', '🐥', '🐨', '🐹', '🦄', '🐧', '🐯'];
    const KIND_LABEL = { meaning: 'Kanji → Arti', reading: 'Kanji → Cara baca', reverse: 'Arti → Kanji', mix: 'Campur semua' };
    const KIND_ASK = { meaning: 'Apa artinya?', reading: 'Bagaimana cara bacanya?', reverse: 'Kanji yang mana?' };
    const LETTERS = ['A', 'B', 'C', 'D'];
    const N = () => (window.KANJI_DATA || []).length || 610;
    const say = (t, ms) => window.cuteSay && window.cuteSay(t, ms);
    const popAt = (el, n, set) => window.cutePopAt && window.cutePopAt(el, n, set);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const store = {
        get(k, d) { try { return JSON.parse(localStorage.getItem('duel-' + k)) ?? d; } catch (_) { return d; } },
        set(k, v) { try { localStorage.setItem('duel-' + k, JSON.stringify(v)); } catch (_) {} },
        del(k) { try { localStorage.removeItem('duel-' + k); } catch (_) {} },
    };

    let visible = false;
    let session = store.get('session', null);   // { code, pid, token }
    let profile = store.get('profile', { name: '', avatar: AVATARS[0] });
    let state = null;                            // last snapshot
    let offset = 0, bestRtt = Infinity;          // serverNow ≈ Date.now() + offset
    let pollTimer = null, raf = 0, inflight = false, failures = 0;
    let viewKey = '';
    let pendingChoice = null;
    let entryError = '';
    let busy = false;

    const now = () => Date.now() + offset;

    async function api(action, body) {
        const t0 = Date.now();
        const opts = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {};
        let url = API + action;
        if (!body && session) url += `?code=${encodeURIComponent(session.code)}&pid=${encodeURIComponent(session.pid)}&token=${encodeURIComponent(session.token)}`;
        const res = await fetch(url, opts);
        const t1 = Date.now();
        const data = await res.json().catch(() => ({ error: 'Respon server tidak valid' }));
        if (data && typeof data.serverNow === 'number') {
            const rtt = t1 - t0;
            const est = data.serverNow - (t0 + t1) / 2;
            // Prefer low-latency samples; drift slowly toward new ones.
            if (rtt <= bestRtt * 1.5 || bestRtt === Infinity) { offset = bestRtt === Infinity ? est : offset * 0.6 + est * 0.4; bestRtt = Math.min(bestRtt, rtt); }
        }
        if (!res.ok) { const e = new Error(data.error || 'Gagal'); e.status = res.status; throw e; }
        return data;
    }
    const auth = extra => ({ code: session.code, pid: session.pid, token: session.token, ...extra });

    /* ---------------- Polling loop ---------------- */
    function schedule(ms) { clearTimeout(pollTimer); if (visible && session) pollTimer = setTimeout(poll, ms); }
    function interval() {
        const st = state?.room?.status;
        if (st === 'question' || st === 'countdown') return 650;
        if (st === 'reveal') return 900;
        return 1500;
    }
    async function poll() {
        if (!session || inflight) return schedule(interval());
        inflight = true;
        try {
            apply(await api('state'));
            failures = 0;
        } catch (e) {
            if (e.status === 403 || e.status === 404) { leaveLocal(e.status === 404 ? 'Room sudah ditutup 🥺' : 'Kamu sudah tidak ada di room ini'); inflight = false; return; }
            failures++;
            setConn(false);
        } finally { inflight = false; }
        schedule(interval());
    }
    function setConn(ok) { const el = root.querySelector('.du-conn'); if (el) el.classList.toggle('bad', !ok); }

    /* ---------------- Apply snapshot ---------------- */
    function apply(snap) {
        const prev = state;
        state = snap;
        setConn(true);
        const r = snap.room;
        const me = snap.players.find(p => p.id === snap.me);
        const key = [r.status, r.qIndex, !!(snap.question && snap.question.myChoice !== null), r.hostId === snap.me].join('|');
        if (r.status !== 'question') pendingChoice = null;
        if (key !== viewKey || r.status === 'lobby' && lobbySig(prev) !== lobbySig(snap)) {
            const changed = key !== viewKey;
            viewKey = key;
            render();
            if (changed) onPhaseChange(prev, snap, me);
        } else {
            patch();
        }
        startRaf();
    }
    const lobbySig = s => s ? JSON.stringify([s.players.map(p => [p.id, p.name, p.avatar, p.online]), s.room.settings]) : '';

    function onPhaseChange(prev, snap, me) {
        const st = snap.room.status;
        if (st === 'reveal' && me && me.result) {
            if (me.result.correct) { say(`Benar! +${me.result.points} poin 🎉`, 1800); setTimeout(() => popAt(root.querySelector('.du-opt.right'), 10, ['💗', '✨', '⭐', '🌸']), 50); }
            else say('Yaah salah, gapapa! 🥺💪', 1800);
        }
        if (st === 'finished') {
            const top = [...snap.players].sort((a, b) => b.score - a.score)[0];
            if (top && top.id === snap.me) { say('KAMU JUARANYA!! 🏆💗', 4000); confetti(); }
            else if (top) say(`${top.name} juaranya! Next time kamu pasti menang 💪`, 3500);
        }
    }

    /* ---------------- Rendering ---------------- */
    function render() {
        if (!session || !state) return renderEntry();
        const st = state.room.status;
        if (st === 'lobby') return renderLobby();
        if (st === 'countdown') return renderCountdown();
        if (st === 'question' || st === 'reveal') return renderQuestion();
        if (st === 'finished') return renderFinish();
    }

    function shell(inner, cls = '') {
        const r = state?.room;
        root.innerHTML = `
            <div class="du-wrap ${cls}">
                ${r ? `<div class="du-topbar">
                    <span class="du-roomtag">ROOM <b>${esc(r.code)}</b></span>
                    <span class="du-conn" title="Koneksi realtime"><i></i>live</span>
                    <button type="button" class="du-leave" data-act="leave">Keluar</button>
                </div>` : ''}
                ${inner}
            </div>`;
    }

    function renderEntry() {
        const urlCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
        root.innerHTML = `
        <div class="du-wrap du-entry">
            <div class="du-hero">
                <span class="lux-kicker">✦ Multiplayer realtime ✦</span>
                <h3>Duel Kanji <span class="font-jp">漢字</span> ⚔️</h3>
                <p>Adu cepat tebak kanji bareng teman. Makin cepat jawab, makin besar poinnya! Soal lanjut setelah semua pemain menjawab.</p>
            </div>
            <div class="du-panel du-profile">
                <label class="du-field"><span>Nama kamu</span>
                    <input id="du-name" maxlength="16" placeholder="contoh: Sakura" value="${esc(profile.name)}" autocomplete="nickname">
                </label>
                <div class="du-field"><span>Pilih avatar</span>
                    <div class="du-avatars" role="radiogroup" aria-label="Avatar">
                        ${AVATARS.map(a => `<button type="button" role="radio" class="du-av ${a === profile.avatar ? 'on' : ''}" aria-checked="${a === profile.avatar}" data-av="${a}">${a}</button>`).join('')}
                    </div>
                </div>
            </div>
            <div class="du-split">
                <div class="du-panel du-create">
                    <div class="du-ph"><span class="du-ico">👑</span><div><b>Buat room</b><small>Kamu jadi host & atur soalnya</small></div></div>
                    <button type="button" class="du-btn primary" data-act="create" ${busy ? 'disabled' : ''}>✨ Buat Room Baru</button>
                </div>
                <div class="du-or" aria-hidden="true">atau</div>
                <div class="du-panel du-join">
                    <div class="du-ph"><span class="du-ico">🔑</span><div><b>Gabung room</b><small>Masukkan kode dari pembuat room</small></div></div>
                    <div class="du-joinrow">
                        <input id="du-code" class="du-code-in" maxlength="5" placeholder="KODE" value="${esc(urlCode)}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Kode room">
                        <button type="button" class="du-btn dark" data-act="join" ${busy ? 'disabled' : ''}>Gabung →</button>
                    </div>
                </div>
            </div>
            <p class="du-error" role="alert">${esc(entryError)}</p>
            <div class="du-rules">
                <div><b>⚡ Cepat = poin besar</b><small>Maks 1000 poin per soal, turun seiring waktu.</small></div>
                <div><b>⏳ Tunggu semua</b><small>Soal lanjut setelah semua pemain jawab / waktu habis.</small></div>
                <div><b>🔥 Combo streak</b><small>Benar beruntun dapat bonus hingga +200.</small></div>
                <div><b>🏆 Skor tertinggi menang</b><small>Podium juara di akhir game.</small></div>
            </div>
        </div>`;
    }

    function packOptions(s) {
        const SIZE = 50, packs = [], total = N();
        for (let i = 0; i < total; i += SIZE) packs.push([i + 1, Math.min(i + SIZE, total)]);
        if (packs.length > 1 && packs[packs.length - 1][1] - packs[packs.length - 1][0] < 19) { const l = packs.pop(); packs[packs.length - 1][1] = l[1]; }
        let match = false;
        const opts = [[1, total, `🌟 Semua kanji (1–${total})`], ...packs.map(([a, b], i) => [a, b, `📦 Paket ${i + 1} (no. ${a}–${b})`])]
            .map(([a, b, label]) => { const on = s.from === a && s.to === b; if (on) match = true; return `<option value="${a}-${b}" ${on ? 'selected' : ''}>${label}</option>`; });
        opts.push(`<option value="custom" ${match ? '' : 'selected'}>✏️ Custom (no. ${s.from}–${s.to})</option>`);
        return opts.join('');
    }

    function renderLobby() {
        const r = state.room, s = r.settings, isHost = r.hostId === state.me;
        const link = `${location.origin}${location.pathname}?room=${r.code}#duel`;
        const players = state.players;
        shell(`
            <div class="du-lobby">
                <div class="du-panel du-codecard">
                    <span class="lux-kicker">Kode room</span>
                    <div class="du-bigcode" aria-label="Kode room ${esc(r.code)}">${[...r.code].map(c => `<span>${esc(c)}</span>`).join('')}</div>
                    <div class="du-share">
                        <button type="button" class="du-btn ghost sm" data-act="copy-code">📋 Salin kode</button>
                        <button type="button" class="du-btn ghost sm" data-act="copy-link" data-link="${esc(link)}">🔗 Salin link undangan</button>
                    </div>
                    <small class="du-muted">Bagikan kode ini ke teman, lalu mereka pilih <b>Gabung room</b>.</small>
                </div>

                <div class="du-panel du-players">
                    <div class="du-ph2"><b>Pemain</b><span>${players.length} / 8</span></div>
                    <ul class="du-plist">
                        ${players.map(p => `
                            <li class="${p.online ? '' : 'off'} ${p.id === state.me ? 'me' : ''}">
                                <span class="du-pav">${esc(p.avatar)}</span>
                                <span class="du-pname">${esc(p.name)}${p.id === state.me ? ' <em>(kamu)</em>' : ''}</span>
                                ${p.id === r.hostId ? '<span class="du-badge gold">👑 host</span>' : ''}
                                ${p.online ? '' : '<span class="du-badge">offline</span>'}
                            </li>`).join('')}
                        ${players.length < 2 ? '<li class="du-wait"><span class="du-dots"><i></i><i></i><i></i></span> Menunggu teman bergabung…</li>' : ''}
                    </ul>
                </div>

                <div class="du-panel du-settings">
                    <div class="du-ph2"><b>Pengaturan game</b>${isHost ? '<span>kamu host 👑</span>' : '<span>diatur host</span>'}</div>
                    ${isHost ? `
                    <div class="du-grid2">
                        <label class="du-field full"><span>Rentang kanji</span>
                            <select id="du-pack">${packOptions(s)}</select>
                        </label>
                        <div class="du-field full du-range ${packOptions(s).includes('value="custom" selected') ? '' : 'hide'}">
                            <span>Custom nomor</span>
                            <div class="du-rangerow"><input type="number" id="du-from" min="1" max="${N()}" value="${s.from}"><b>→</b><input type="number" id="du-to" min="1" max="${N()}" value="${s.to}"></div>
                        </div>
                        <label class="du-field full"><span>Jenis soal</span>
                            <div class="du-seg" data-seg="kind">${Object.entries(KIND_LABEL).map(([k, l]) => `<button type="button" class="${s.kind === k ? 'on' : ''}" data-val="${k}">${l}</button>`).join('')}</div>
                        </label>
                        <label class="du-field"><span>Jumlah soal</span>
                            <div class="du-seg" data-seg="count">${[5, 10, 20, 30, 50].map(n => `<button type="button" class="${s.count === n ? 'on' : ''}" data-val="${n}">${n}</button>`).join('')}</div>
                        </label>
                        <label class="du-field"><span>Waktu / soal</span>
                            <div class="du-seg" data-seg="seconds">${[10, 15, 20].map(n => `<button type="button" class="${s.seconds === n ? 'on' : ''}" data-val="${n}">${n}s</button>`).join('')}</div>
                        </label>
                    </div>
                    <button type="button" class="du-btn primary big" data-act="start">${players.length < 2 ? '▶ Mulai (latihan solo)' : `⚔️ Mulai Duel (${players.length} pemain)`}</button>
                    ` : `
                    <dl class="du-summary">
                        <div><dt>Kanji</dt><dd>no. ${s.from}–${s.to}</dd></div>
                        <div><dt>Jenis</dt><dd>${KIND_LABEL[s.kind]}</dd></div>
                        <div><dt>Soal</dt><dd>${s.count}</dd></div>
                        <div><dt>Waktu</dt><dd>${s.seconds} detik</dd></div>
                    </dl>
                    <div class="du-waithost"><span class="du-dots"><i></i><i></i><i></i></span> Menunggu host memulai game…</div>
                    `}
                </div>
            </div>`, 'is-lobby');
    }

    function renderCountdown() {
        shell(`<div class="du-countdown"><span class="lux-kicker">Siap-siap!</span><div class="du-cd" id="du-cd">3</div><p>${state.players.length} pemain • ${state.room.total} soal • ${KIND_LABEL[state.room.settings.kind]}</p></div>`, 'is-cd');
    }

    function scoreboard(compact) {
        const list = [...state.players].sort((a, b) => b.score - a.score);
        const reveal = state.room.status === 'reveal';
        return `<ol class="du-board ${compact ? 'compact' : ''}">${list.map((p, i) => {
            const res = p.result;
            const st = reveal ? (res ? (res.correct ? `<span class="du-pts up">+${res.points}</span>` : '<span class="du-pts no">✗</span>') : '<span class="du-pts no">⏰</span>')
                : (p.answered ? '<span class="du-chk" title="Sudah menjawab">✓</span>' : '<span class="du-thinking" title="Sedang berpikir"><i></i><i></i><i></i></span>');
            return `<li class="${p.id === state.me ? 'me' : ''} ${p.online ? '' : 'off'}" data-pid="${esc(p.id)}">
                <span class="du-rank">${i + 1}</span><span class="du-pav">${esc(p.avatar)}</span>
                <span class="du-pname">${esc(p.name)}${p.streak >= 2 ? ` <em class="du-streak">🔥${p.streak}</em>` : ''}</span>
                <span class="du-score">${p.score}</span>${st}</li>`;
        }).join('')}</ol>`;
    }

    function renderQuestion() {
        const r = state.room, q = state.question;
        if (!q) return;
        const reveal = r.status === 'reveal';
        const mine = q.myChoice ?? pendingChoice;
        const big = q.kind !== 'reverse';
        const optClass = i => {
            const c = ['du-opt'];
            if (mine === i) c.push('picked');
            if (q.answer !== undefined) { if (i === q.answer) c.push('right'); else if (mine === i) c.push('wrong'); }
            return c.join(' ');
        };
        const meRes = state.players.find(p => p.id === state.me)?.result;
        const waitCount = state.players.filter(p => p.online && !p.answered).length;
        shell(`
            <div class="du-game">
                <div class="du-qmain">
                    <div class="du-qhead">
                        <span class="du-qnum">Soal <b>${r.qIndex + 1}</b> / ${r.total}</span>
                        <span class="du-kind">${KIND_LABEL[q.kind]}</span>
                        <span class="du-secs" id="du-secs">${r.settings.seconds}</span>
                    </div>
                    <div class="du-timer"><i id="du-bar"></i></div>
                    <div class="du-prompt ${big ? 'kanji' : 'text'}">
                        <small>${KIND_ASK[q.kind]}</small>
                        <div class="${big ? 'font-jp' : ''}">${esc(q.prompt)}</div>
                        ${q.sub ? `<em class="font-jp">${esc(q.sub)}</em>` : ''}
                    </div>
                    <div class="du-opts ${q.kind === 'reverse' || q.kind === 'reading' ? 'jp' : ''}">
                        ${q.choices.map((c, i) => `<button type="button" class="${optClass(i)}" data-choice="${i}" ${mine !== null || reveal ? 'disabled' : ''}>
                            <span class="du-letter">${LETTERS[i]}</span><span class="du-otext ${q.kind === 'meaning' ? '' : 'font-jp'}">${esc(c)}</span></button>`).join('')}
                    </div>
                    <div class="du-status" id="du-status">
                        ${reveal ? (q.card ? `<div class="du-card"><b class="font-jp">${esc(q.card.kanji)}</b><span class="font-jp">${esc(q.card.kana)}</span><span>${esc(q.card.arti)}</span>
                            ${meRes ? (meRes.correct ? `<span class="du-gain">+${meRes.points} poin • ${(meRes.ms / 1000).toFixed(2)}s</span>` : '<span class="du-gain no">0 poin</span>') : '<span class="du-gain no">Waktu habis ⏰</span>'}</div>
                            <small class="du-next" id="du-next">Soal berikutnya…</small>` : '')
                        : mine !== null ? `<div class="du-locked">${q.answer !== undefined ? (mine === q.answer ? '✅ Benar! Menunggu pemain lain…' : '❌ Kurang tepat. Menunggu pemain lain…') : 'Mengirim jawaban…'}
                            <span class="du-wcount" id="du-wcount">${waitCount ? `${waitCount} pemain belum jawab` : ''}</span></div>`
                        : '<small class="du-hint">Pilih jawaban — atau tekan 1 / 2 / 3 / 4</small>'}
                    </div>
                </div>
                <aside class="du-side"><div class="du-ph2"><b>Skor live</b><span>${state.players.length} pemain</span></div><div id="du-board">${scoreboard(true)}</div></aside>
            </div>`, reveal ? 'is-reveal' : 'is-q');
    }

    function renderFinish() {
        const list = [...state.players].sort((a, b) => b.score - a.score || b.correct - a.correct);
        const isHost = state.room.hostId === state.me;
        const podium = [list[1], list[0], list[2]];
        const meRank = list.findIndex(p => p.id === state.me) + 1;
        shell(`
            <div class="du-finish">
                <span class="lux-kicker">Game selesai</span>
                <h3>${list[0] ? `🏆 ${esc(list[0].name)} juaranya!` : 'Game selesai'}</h3>
                <p class="du-muted">${meRank ? `Kamu peringkat <b>#${meRank}</b> dari ${list.length} pemain` : ''}</p>
                <div class="du-podium">
                    ${podium.map((p, i) => p ? `<div class="du-pod p${[2, 1, 3][i]}">
                        <span class="du-crown">${['🥈', '👑', '🥉'][i]}</span>
                        <span class="du-pav xl">${esc(p.avatar)}</span>
                        <b>${esc(p.name)}</b><span class="du-score">${p.score}</span>
                        <div class="du-step"><span>${[2, 1, 3][i]}</span></div></div>` : '<div class="du-pod empty"></div>').join('')}
                </div>
                <ol class="du-final">${list.map((p, i) => `<li class="${p.id === state.me ? 'me' : ''}"><span class="du-rank">${i + 1}</span><span class="du-pav">${esc(p.avatar)}</span><span class="du-pname">${esc(p.name)}</span><small>${p.correct}/${state.room.total} benar</small><span class="du-score">${p.score}</span></li>`).join('')}</ol>
                <div class="du-row">
                    ${isHost ? '<button type="button" class="du-btn primary" data-act="rematch">🔁 Main lagi</button><button type="button" class="du-btn ghost" data-act="tolobby">⚙️ Ubah pengaturan</button>'
                        : '<div class="du-waithost"><span class="du-dots"><i></i><i></i><i></i></span> Menunggu host memulai ronde baru…</div>'}
                </div>
            </div>`, 'is-finish');
    }

    // Light updates between full renders (no flicker)
    function patch() {
        const st = state.room.status;
        if (st === 'question' || st === 'reveal') {
            const b = root.querySelector('#du-board'); if (b) b.innerHTML = scoreboard(true);
            const w = root.querySelector('#du-wcount');
            if (w) { const n = state.players.filter(p => p.online && !p.answered).length; w.textContent = n ? `${n} pemain belum jawab` : ''; }
        }
    }

    /* ---------------- Clock-driven animation ---------------- */
    function startRaf() { if (!raf && visible) raf = requestAnimationFrame(frame); }
    function frame() {
        raf = 0;
        if (!state || !visible) return;
        const r = state.room, t = now();
        if (r.status === 'countdown') {
            const el = root.querySelector('#du-cd');
            const left = Math.max(0, Math.ceil((r.phaseEndsAt - t) / 1000));
            const txt = left > 0 ? String(left) : 'GO!';
            if (el && el.textContent !== txt) { el.textContent = txt; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
        } else if (r.status === 'question') {
            const total = r.phaseEndsAt - r.phaseStartedAt;
            const left = Math.max(0, r.phaseEndsAt - Math.max(t, r.phaseStartedAt));
            const bar = root.querySelector('#du-bar'), secs = root.querySelector('#du-secs');
            if (bar) { bar.style.transform = `scaleX(${left / total})`; bar.classList.toggle('low', left < total * 0.3); }
            if (secs) { const s = String(Math.ceil(left / 1000)); if (secs.textContent !== s) secs.textContent = s; secs.classList.toggle('low', left < total * 0.3); }
            if (left <= 0 && state.question?.myChoice === null) root.querySelectorAll('.du-opt').forEach(b => b.disabled = true);
        } else if (r.status === 'reveal') {
            const bar = root.querySelector('#du-bar'); if (bar) bar.style.transform = 'scaleX(0)';
            const nx = root.querySelector('#du-next');
            if (nx) {
                const left = Math.max(0, Math.ceil((r.phaseEndsAt - t) / 1000));
                const txt = r.qIndex + 1 >= r.total ? `Hasil akhir dalam ${left}…` : `Soal berikutnya dalam ${left}…`;
                if (nx.textContent !== txt) nx.textContent = txt;
            }
        } else return;
        raf = requestAnimationFrame(frame);
    }

    /* ---------------- Actions ---------------- */
    function readProfile() {
        const n = root.querySelector('#du-name');
        if (n) profile.name = n.value.trim().slice(0, 16);
        store.set('profile', profile);
        return profile.name;
    }
    async function enter(action) {
        const name = readProfile();
        if (!name) { entryError = 'Isi nama dulu ya~ 🌷'; renderEntry(); root.querySelector('#du-name')?.focus(); return; }
        const body = { name, avatar: profile.avatar };
        if (action === 'join') {
            const code = (root.querySelector('#du-code')?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (code.length !== 5) { entryError = 'Kode room terdiri dari 5 karakter'; renderEntry(); root.querySelector('#du-code')?.focus(); return; }
            body.code = code;
        } else {
            body.settings = store.get('settings', { from: 1, to: Math.min(50, N()), count: 10, seconds: 15, kind: 'meaning' });
        }
        busy = true; entryError = ''; renderEntry();
        try {
            const res = await api(action, body);
            session = res; store.set('session', session);
            clearRoomParam();
            viewKey = '';
            await poll();
            say(action === 'create' ? 'Room siap! Bagikan kodenya ya 💌' : 'Berhasil gabung! Ganbatte~ 💪', 2400);
        } catch (e) {
            entryError = e.message; renderEntry();
        } finally { busy = false; if (!session) renderEntry(); }
    }
    function clearRoomParam() {
        const u = new URL(location.href);
        if (u.searchParams.has('room')) { u.searchParams.delete('room'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    }
    function leaveLocal(msg) {
        session = null; state = null; viewKey = ''; store.del('session');
        clearTimeout(pollTimer); entryError = msg || '';
        renderEntry();
    }
    async function act(fn) {
        try { const snap = await fn(); if (snap && snap.room) apply(snap); }
        catch (e) { say(e.message + ' 🥺', 2200); if (e.status === 403 && /anggota/.test(e.message)) leaveLocal(e.message); }
    }

    let settingsTimer = 0;
    function pushSettings(patchObj) {
        const s = { ...state.room.settings, ...patchObj };
        state.room.settings = s;
        store.set('settings', s);
        renderLobby();
        clearTimeout(settingsTimer);
        settingsTimer = setTimeout(() => act(() => api('settings', auth({ settings: s }))), 250);
    }

    async function answer(i) {
        const r = state?.room, q = state?.question;
        if (!r || r.status !== 'question' || !q || q.myChoice !== null || pendingChoice !== null) return;
        if (now() > r.phaseEndsAt + 400) return;
        pendingChoice = i;
        const btn = root.querySelector(`.du-opt[data-choice="${i}"]`);
        root.querySelectorAll('.du-opt').forEach(b => { b.disabled = true; });
        btn?.classList.add('picked');
        popAt(btn, 6, ['✨', '💫']);
        const st = root.querySelector('#du-status'); if (st) st.innerHTML = '<div class="du-locked">Jawaban terkunci 🔒 Mengirim…</div>';
        try { apply(await api('answer', auth({ q: r.qIndex, choice: i }))); }
        catch (e) { pendingChoice = null; say(e.message, 2000); viewKey = ''; poll(); }
    }

    root.addEventListener('click', async e => {
        const av = e.target.closest('[data-av]');
        if (av) { readProfile(); profile.avatar = av.dataset.av; store.set('profile', profile); renderEntry(); return; }
        const ch = e.target.closest('[data-choice]');
        if (ch && !ch.disabled) return answer(+ch.dataset.choice);
        const seg = e.target.closest('[data-seg] button');
        if (seg) {
            const k = seg.parentElement.dataset.seg, v = seg.dataset.val;
            return pushSettings({ [k]: k === 'kind' ? v : +v });
        }
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        const a = b.dataset.act;
        if (a === 'create' || a === 'join') return enter(a);
        if (a === 'leave') {
            if (!confirm('Keluar dari room ini?')) return;
            const s = session; leaveLocal('');
            try { await api('leave', { code: s.code, pid: s.pid, token: s.token }); } catch (_) {}
            return;
        }
        if (a === 'copy-code' || a === 'copy-link') {
            const txt = a === 'copy-code' ? state.room.code : b.dataset.link;
            try { await navigator.clipboard.writeText(txt); b.textContent = '✅ Tersalin!'; }
            catch (_) { prompt('Salin ini:', txt); }
            setTimeout(() => { if (b.isConnected) b.textContent = a === 'copy-code' ? '📋 Salin kode' : '🔗 Salin link undangan'; }, 1600);
            return;
        }
        if (a === 'start') { b.disabled = true; return act(() => api('start', auth({ settings: state.room.settings }))); }
        if (a === 'rematch') { b.disabled = true; return act(() => api('start', auth({}))); }
        if (a === 'tolobby') { b.disabled = true; return act(() => api('lobby', auth({}))); }
    });
    root.addEventListener('change', e => {
        if (e.target.id === 'du-pack') {
            const v = e.target.value;
            if (v === 'custom') { root.querySelector('.du-range')?.classList.remove('hide'); return; }
            const [from, to] = v.split('-').map(Number);
            pushSettings({ from, to });
        }
        if (e.target.id === 'du-from' || e.target.id === 'du-to') {
            const total = N();
            let from = Math.max(1, Math.min(total, +root.querySelector('#du-from').value || 1));
            let to = Math.max(1, Math.min(total, +root.querySelector('#du-to').value || total));
            if (from > to) [from, to] = [to, from];
            pushSettings({ from, to });
        }
    });
    root.addEventListener('input', e => {
        if (e.target.id === 'du-code') e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    root.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        if (e.target.id === 'du-code') enter('join');
        if (e.target.id === 'du-name') root.querySelector('#du-code')?.value ? enter('join') : null;
    });
    document.addEventListener('keydown', e => {
        if (!visible || !state || state.room.status !== 'question') return;
        if (e.target.closest && e.target.closest('input, select, textarea')) return;
        const i = ['1', '2', '3', '4'].indexOf(e.key);
        if (i >= 0) { e.preventDefault(); answer(i); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && session) poll(); });

    function confetti() {
        const colors = ['#f476a8', '#ffd36b', '#9be3c4', '#b9a7ff', '#ff9bc3'];
        for (let i = 0; i < 70; i++) {
            const c = document.createElement('i');
            c.className = 'confetti';
            c.style.left = Math.random() * 100 + 'vw';
            c.style.background = colors[i % colors.length];
            c.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
            c.style.animationDelay = Math.random() * .6 + 's';
            c.style.borderRadius = i % 3 ? '2px' : '50%';
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 4200);
        }
    }

    window.Duel = {
        show() {
            if (visible) return;
            visible = true;
            if (session) { if (state) render(); else root.innerHTML = '<div class="du-wrap"><div class="du-loading"><span class="du-dots"><i></i><i></i><i></i></span> Menyambung ke room…</div></div>'; poll(); }
            else renderEntry();
        },
        hide() { visible = false; clearTimeout(pollTimer); cancelAnimationFrame(raf); raf = 0; },
    };
    if (document.body.dataset.mode === 'duel') window.Duel.show();
})();
