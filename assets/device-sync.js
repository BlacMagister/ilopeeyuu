/*
 * Device ID + progress backup.
 * Every device/browser gets its own code (e.g. "K7QM-2XPA-9RTD"). All the
 * games still save to localStorage; this script mirrors those saved keys to
 * /api/progress so the progress comes back after the browser is closed, the
 * tab is removed, or the site data is cleared. The code can also be typed in
 * on another browser to continue there.
 */
(function () {
  var API = '/api/progress';
  var ID_KEY = 'sakura-device-id';
  var AT_KEY = 'sakura-sync-at';
  var RELOAD_FLAG = 'sakura-sync-reloaded';
  // Never backed up: the private-room login token and the sync bookkeeping itself.
  var SKIP = { 'sk_session': 1 };
  SKIP[ID_KEY] = 1; SKIP[AT_KEY] = 1;
  var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  var ls;
  try { ls = window.localStorage; ls.getItem('x'); } catch (_) { return; }

  var ready = false, lastSent = null, pushing = false, statusEl = null, state = 'loading';

  function newId() {
    var b = new Uint8Array(12), s = '';
    (window.crypto || window.msCrypto).getRandomValues(b);
    for (var i = 0; i < 12; i++) { s += CHARS[b[i] % 32]; if (i === 3 || i === 7) s += '-'; }
    return s;
  }
  function cleanId(v) {
    var s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length !== 12) return null;
    for (var i = 0; i < 12; i++) if (CHARS.indexOf(s[i]) < 0) return null;
    return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
  }
  function snapshot() {
    var out = {};
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i);
      if (k && !SKIP[k]) out[k] = ls.getItem(k);
    }
    return out;
  }
  function sameAsLocal(data) {
    var cur = snapshot(), k;
    for (k in data) if (!SKIP[k] && cur[k] !== data[k]) return false;
    return true;
  }
  /** Replace the backed-up keys with `data`. Returns true when something changed. */
  function apply(data, replaceAll) {
    var changed = !sameAsLocal(data), k;
    if (replaceAll) {
      var cur = snapshot();
      for (k in cur) if (!(k in data)) { ls.removeItem(k); changed = true; }
    }
    for (k in data) if (!SKIP[k] && typeof data[k] === 'string') ls.setItem(k, data[k]);
    return changed;
  }
  function reloadOnce() {
    try { if (sessionStorage.getItem(RELOAD_FLAG)) return false; sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (_) {}
    location.reload();
    return true;
  }
  function setState(s) { state = s; renderStatus(); }

  function getJSON(id) {
    return fetch(API + (id ? '?id=' + encodeURIComponent(id) : ''), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.status === 404 ? null : r.ok ? r.json() : Promise.reject(r.status); });
  }

  function push(beacon) {
    if (!ready) return;
    var id = ls.getItem(ID_KEY);
    var body = JSON.stringify({ id: id, data: snapshot() });
    if (body === lastSent || (pushing && !beacon)) return;
    if (beacon) {
      // Only remember it as sent once the server confirms, so a failed page-hide save is retried later.
      try {
        fetch(API, { method: 'PUT', body: body, keepalive: body.length < 60000, headers: { 'content-type': 'application/json' }, credentials: 'same-origin' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (res) { if (res) { lastSent = body; ls.setItem(AT_KEY, String(res.updatedAt)); } }, function () {});
      } catch (_) {}
      return;
    }
    pushing = true;
    fetch(API, { method: 'PUT', body: body, headers: { 'content-type': 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (res) { lastSent = body; ls.setItem(AT_KEY, String(res.updatedAt)); setState('ok'); })
      .catch(function () { setState('offline'); })
      .then(function () { pushing = false; });
  }

  function start() {
    var id = cleanId(ls.getItem(ID_KEY));
    var localAt = +ls.getItem(AT_KEY) || 0;
    var hadId = !!id;
    // Known id → ask for that id. No id (new browser or storage wiped) → ask the device cookie.
    getJSON(id).then(function (res) {
      if (res && res.data) {
        if (!hadId) { ls.setItem(ID_KEY, res.id); id = res.id; }
        if (!hadId || res.updatedAt > localAt) {
          var changed = apply(res.data, false);
          ls.setItem(AT_KEY, String(res.updatedAt));
          if (changed && reloadOnce()) return;
        }
      }
      if (!id) { id = newId(); ls.setItem(ID_KEY, id); }
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch (_) {}
      ready = true;
      setState('ok');
      push();
    }).catch(function () {
      if (!id) { id = newId(); ls.setItem(ID_KEY, id); }
      setState('offline');
      // Offline: keep playing locally, try again later without overwriting the backup first.
      setTimeout(start, 20000);
    });
  }

  /** Continue on this browser with the progress of another device code. */
  function restore(code) {
    var id = cleanId(code);
    if (!id) return Promise.reject('Kode tidak valid. Formatnya seperti ABCD-EFGH-JKLM.');
    return getJSON(id).then(function (res) {
      if (!res) throw 'Kode tidak ditemukan.';
      apply(res.data, true);
      ls.setItem(ID_KEY, id);
      ls.setItem(AT_KEY, String(res.updatedAt));
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch (_) {}
      location.reload();
    }, function () { throw 'Gagal terhubung. Coba lagi ya.'; });
  }

  setInterval(function () { push(); }, 8000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') push(true); });
  window.addEventListener('pagehide', function () { push(true); });

  /* ---------- small UI in the footer ---------- */
  function renderStatus() {
    if (!statusEl) return;
    var id = ls.getItem(ID_KEY) || '…';
    statusEl.querySelector('[data-ds-code]').textContent = id;
    statusEl.querySelector('[data-ds-state]').textContent =
      state === 'ok' ? '✓ Progres tersimpan otomatis' : state === 'offline' ? '⚠ Offline — disimpan di perangkat, dicadangkan saat online' : 'Menyambungkan…';
  }
  function mountUI() {
    var foot = document.querySelector('footer');
    if (!foot || document.getElementById('device-sync')) return;
    var box = document.createElement('div');
    box.id = 'device-sync';
    box.className = 'ds-box';
    box.innerHTML =
      '<div class="ds-row"><span>📱 Kode perangkat:</span> <b class="ds-code" data-ds-code>…</b>' +
      '<button type="button" class="ds-btn" data-ds-copy>Salin</button>' +
      '<button type="button" class="ds-btn" data-ds-open>Pakai kode lain</button></div>' +
      '<div class="ds-state" data-ds-state></div>' +
      '<form class="ds-form" data-ds-form hidden>' +
      '<input class="ds-input" data-ds-input maxlength="14" placeholder="ABCD-EFGH-JKLM" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
      '<button type="submit" class="ds-btn ds-primary">Pulihkan</button>' +
      '<div class="ds-msg" data-ds-msg></div>' +
      '<div class="ds-hint">Progres di browser ini akan diganti dengan progres dari kode tersebut.</div></form>';
    foot.appendChild(box);
    statusEl = box;
    var form = box.querySelector('[data-ds-form]'), msg = box.querySelector('[data-ds-msg]');
    box.querySelector('[data-ds-copy]').addEventListener('click', function (e) {
      var code = ls.getItem(ID_KEY) || '', btn = e.currentTarget;
      var done = function () { btn.textContent = 'Tersalin ✓'; setTimeout(function () { btn.textContent = 'Salin'; }, 1500); };
      var fallback = function () {
        // Older browsers / non-secure contexts: copy through a temporary text field.
        var t = document.createElement('textarea');
        t.value = code; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
        t.remove();
        if (ok) done(); else btn.textContent = code;
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(done, fallback); else fallback();
    });
    box.querySelector('[data-ds-open]').addEventListener('click', function () { form.hidden = !form.hidden; if (!form.hidden) form.querySelector('input').focus(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.textContent = 'Memulihkan…';
      restore(form.querySelector('[data-ds-input]').value).catch(function (err) { msg.textContent = String(err); });
    });
    renderStatus();
  }

  window.SakuraDevice = { id: function () { return ls.getItem(ID_KEY); }, restore: restore, sync: function () { push(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountUI); else mountUI();
  start();
})();
