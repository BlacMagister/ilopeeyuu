(() => {
  const $ = id => document.getElementById(id);
  const stage = $('vs-stage'), audio = $('vs-audio'); if (!stage || !audio) return;
  const vb = $('vb'), jumpEl = vb.querySelector('.vb-jump'), fx = $('vs-fx'), cap = $('vs-cap');
  const poster = $('vs-poster'), end = $('vs-end'), playBtn = $('vs-play'), bar = $('vs-bar'), fill = $('vs-fill'), knob = $('vs-knob'), time = $('vs-time');
  const DUR = 75.9;
  const els = [...stage.querySelectorAll('.vs-el')].map(el => {
    const [a, b] = el.dataset.t.split(',').map(Number);
    const c = el.dataset.cls ? el.dataset.cls.split(':') : null;
    return { el, a, b, ct: c && +c[0], cn: c && c[1] };
  });
  // scene start times, bunny position/size and mood per scene
  const scenes = [[0,1,'50%','62%','22cqw',''],[8.6,2,'24%','62%','24cqw','shy'],[21.6,3,'15%','66%','18cqw','happy'],[38,4,'82%','64%','18cqw',''],[49,5,'22%','60%','22cqw','band-on'],[54.5,5,'79%','80%','10cqw',''],[60.2,6,'20%','64%','20cqw','love'],[71.5,7,'50%','64%','24cqw','happy']];
  const caps = [[0,8,'Boing~! Haaai! Konnichiwa! Aku Usagi-chan, kelinci paling gemes se-Sakura Study Club!'],[8.6,16.4,'Eh eh… aku dititipin pesan rahasia, lho. Katanya ada orang yang sayaaang banget sama kamu.'],[16.6,21.2,'Hihihi~ Siapa ya? Pokoknya dia orangnya ganteng!'],[21.6,24.6,'Nah, di sini kita belajar bahasa Jepang bareng-bareng!'],[24.6,30.6,'Ada hiragana… a, i, u, e, o! Ada katakana!'],[30.6,37.9,'Terus ada kosakata lucu kayak neko, kucing! Inu, anjing! Dan usagi, itu aku! Kyaa~!'],[38,42.3,'Kamu bisa main flashcard, tinggal tap, cling! Kebalik!'],[42.3,48.9,'Terus ada Memory Match juga. Cari pasangannya yang cocok… kayak kamu sama dia! Cieee~!'],[49,54.4,'Kalau salah, nggak apa-apa kok! Pelan-pelan aja. Ganbatte ne! Semangat!'],[54.5,59.9,'Aku bakal nemenin kamu terus di pojok layar, hehe. Tap aku aja kalau butuh semangat!'],[60.2,64.9,'Oh iya, satu lagi kata Jepang yang paling penting… Daisuki.'],[65,71.3,'Artinya sayang banget. Dan itu pesan dari dia buat kamu. Daisuki dayo~!'],[71.5,76,'Yosh! Ayo mulai belajar! Mata ne~! Dadaaah! Boing!']];
  // speech ranges (mouth moves), measured from the voice over
  const talk = [[0.4,7.9],[9,15.9],[16.3,20.7],[21.8,24.6],[25,36.4],[38.4,46.8],[47,48.6],[49.5,53.6],[54.6,59.1],[60.5,70.1],[71.6,75.6]];
  const bursts = [[0.3,'💗🌸✨'],[16.8,'❓❔'],[20.2,'✨💖⭐'],[27,'🌸✨'],[34.7,'💕🐰💗'],[41.1,'✨⭐💫'],[45.1,'💗💖💕'],[47.1,'💞🙈💗'],[53.2,'🔥💪✨'],[64,'💗💖💕🌸'],[69.1,'💗💖💕💞'],[75.2,'💨✨⭐']];
  const jumps = [0.3, 4.2, 20.2, 34.7, 41.1, 45.1, 47.1, 53.2, 64, 69.1, 71.6, 75.2];
  let lastT = 0, raf;
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function burst(set) {
    const r = vb.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const x = r.left - s.left + r.width / 2, y = r.top - s.top + r.height / 3;
    for (let i = 0; i < 12; i++) {
      const e = document.createElement('span'); const ch = [...set];
      e.textContent = ch[i % ch.length]; e.style.left = x + 'px'; e.style.top = y + 'px';
      const a = Math.PI * 2 * i / 12, d = 60 + Math.random() * 80;
      e.style.setProperty('--dx', Math.cos(a) * d + 'px'); e.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px'); e.style.setProperty('--r', (Math.random() * 120 - 60) + 'deg');
      fx.appendChild(e); setTimeout(() => e.remove(), 1000);
    }
  }
  function jump() { jumpEl.classList.remove('jump'); void jumpEl.offsetWidth; jumpEl.classList.add('jump'); }
  function render(t, live) {
    els.forEach(o => { o.el.classList.toggle('on', t >= o.a && t < o.b); if (o.cn) o.el.classList.toggle(o.cn, t >= o.ct); });
    let sc = scenes[0]; scenes.forEach(s => { if (t >= s[0]) sc = s; });
    stage.dataset.scene = sc[1];
    vb.style.setProperty('--bx', sc[2]); vb.style.setProperty('--by', sc[3]); vb.style.setProperty('--bw', sc[4]);
    vb.className = 'vb ' + sc[5];
    if (talk.some(([a, b]) => t >= a && t < b)) vb.classList.add('talk');
    if ((t >= 74.3 && t < 75.3) || (t >= 1.4 && t < 2.6)) vb.classList.add('wave', 'happy');
    const c = caps.find(([a, b]) => t >= a && t < b); cap.textContent = c ? c[2] : ''; cap.classList.toggle('on', !!c);
    if (live && t > lastT && t - lastT < 1) {
      bursts.forEach(([bt, set]) => { if (bt > lastT && bt <= t) burst(set); });
      jumps.forEach(jt => { if (jt > lastT && jt <= t) jump(); });
    }
    lastT = t;
    const p = Math.min(100, t / (audio.duration || DUR) * 100);
    fill.style.width = p + '%'; knob.style.left = p + '%'; bar.setAttribute('aria-valuenow', Math.round(t));
    time.textContent = fmt(t) + ' / ' + fmt(audio.duration || DUR);
  }
  function loop() { render(audio.currentTime, true); if (!audio.paused) raf = requestAnimationFrame(loop); }
  function play() { poster.hidden = true; end.hidden = true; audio.play().catch(() => {}); }
  audio.addEventListener('play', () => { stage.classList.add('playing'); playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Jeda'); cancelAnimationFrame(raf); loop(); });
  audio.addEventListener('pause', () => { stage.classList.remove('playing'); playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Putar'); });
  audio.addEventListener('ended', () => { render(audio.duration, false); setTimeout(() => { end.hidden = false; }, 900); });
  audio.addEventListener('loadedmetadata', () => render(audio.currentTime, false));
  poster.addEventListener('click', play);
  playBtn.addEventListener('click', () => audio.paused ? play() : audio.pause());
  $('vs-replay').addEventListener('click', () => { audio.currentTime = 0; lastT = 0; play(); });
  $('vs-go').addEventListener('click', () => audio.pause());
  stage.addEventListener('click', e => { if (e.target.closest('.vs-poster,.vs-end')) return; audio.paused ? play() : audio.pause(); });
  const seek = x => { const r = bar.getBoundingClientRect(); audio.currentTime = Math.max(0, Math.min(1, (x - r.left) / r.width)) * (audio.duration || DUR); poster.hidden = true; end.hidden = true; render(audio.currentTime, false); };
  bar.addEventListener('pointerdown', e => { seek(e.clientX); const mv = ev => seek(ev.clientX); bar.addEventListener('pointermove', mv); addEventListener('pointerup', () => bar.removeEventListener('pointermove', mv), { once: true }); });
  bar.addEventListener('keydown', e => { if (e.key === 'ArrowRight') audio.currentTime += 5; else if (e.key === 'ArrowLeft') audio.currentTime -= 5; else return; e.preventDefault(); render(audio.currentTime, false); });
  $('vs-cc').addEventListener('click', e => { const on = stage.classList.toggle('nocc'); e.currentTarget.setAttribute('aria-pressed', String(!on)); });
  $('vs-fs').addEventListener('click', () => { const f = $('vs-frame'); document.fullscreenElement ? document.exitFullscreen() : f.requestFullscreen?.(); });
  render(0, false);
  window.UsagiShow = { stage, audio, restart() { audio.pause(); audio.currentTime = 0; lastT = 0; render(0, false); play(); } };
})();
