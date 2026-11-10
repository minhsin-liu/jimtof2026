// 拖曳上傳、剪貼簿貼上、記住收集人、送出時鎖定按鈕
(function () {
  const zones = [...document.querySelectorAll('.dropzone')];

  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  zones.forEach(zone => {
    const input = zone.querySelector('input[type=file]');
    const list = zone.querySelector('.filelist');
    const dt = new DataTransfer();

    function render() {
      input.files = dt.files;
      list.innerHTML = '';
      [...dt.files].forEach((f, i) => {
        const li = document.createElement('li');
        if (f.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          li.appendChild(img);
        }
        const n = document.createElement('span');
        n.className = 'n';
        n.textContent = f.name;
        const s = document.createElement('small');
        s.className = 'muted';
        s.textContent = fmtSize(f.size);
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '✕';
        rm.title = '移除';
        rm.setAttribute('aria-label', '移除 ' + f.name);
        rm.onclick = e => { e.stopPropagation(); dt.items.remove(i); render(); };
        li.append(n, s, rm);
        list.appendChild(li);
      });
    }

    zone.add = files => { [...files].forEach(f => dt.items.add(f)); render(); };
    zone.addEventListener('click', e => { if (!e.target.closest('li')) input.click(); });
    zone.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === zone) { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => {
      const picked = [...input.files];
      picked.forEach(f => { if (![...dt.files].includes(f)) dt.items.add(f); });
      render();
    });
    ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', e => zone.add(e.dataTransfer.files));
  });

  // Ctrl+V 貼上截圖（例如 LINE / Teams 傳來的圖片）
  document.addEventListener('paste', e => {
    if (!zones.length) return;
    const files = [...e.clipboardData.items].filter(it => it.kind === 'file').map(it => it.getAsFile()).filter(Boolean);
    if (!files.length) return;
    e.preventDefault();
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    zones[0].add(files.map((f, i) => new File([f], f.name && f.name !== 'image.png' ? f.name : `貼上_${stamp}_${i + 1}.png`, { type: f.type })));
  });

  // 記住收集人
  const KEY = 'jimtof-crm-collector';
  document.querySelectorAll('input[data-remember=collector]').forEach(inp => {
    try { if (!inp.value) inp.value = localStorage.getItem(KEY) || ''; } catch (_) {}
    inp.form && inp.form.addEventListener('submit', () => { try { if (inp.value) localStorage.setItem(KEY, inp.value); } catch (_) {} });
  });

  // 上傳中鎖定按鈕，避免重複送出
  document.querySelectorAll('form[data-busy]').forEach(form => form.addEventListener('submit', () => {
    form.setAttribute('aria-busy', 'true');
    form.querySelectorAll('button:not([type=button])').forEach(b => { b.disabled = true; b.classList.add('is-busy'); b.textContent = '上傳中，請稍候…'; });
  }));
})();

// 一頁圖列印 / 存 PDF：只印指定的那一張
function printSlide(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('print-target');
  document.body.classList.add('print-slide');
  const done = () => {
    el.classList.remove('print-target');
    document.body.classList.remove('print-slide');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

// ---------- 介面互動 ----------
(function () {
  // 防抖：連續觸發時只在停下來後執行一次
  function debounce(fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  // 導覽列陰影、回到頂端：用 IntersectionObserver，不監聽 scroll
  const bar = document.querySelector('.topbar');
  const top = document.querySelector('.to-top');
  if ('IntersectionObserver' in window && bar) {
    const s = document.createElement('div');
    s.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:240px;pointer-events:none';
    document.body.prepend(s);
    new IntersectionObserver(([e]) => {
      bar.classList.toggle('scrolled', !e.isIntersecting);
      top && top.classList.toggle('show', !e.isIntersecting);
    }).observe(s);
  }
  top && top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // 手機選單：視窗變寬時自動收起（resize 防抖）
  window.addEventListener('resize', debounce(() => {
    if (window.innerWidth > 1000) document.body.classList.remove('nav-open');
  }, 150), { passive: true });

  // 即時篩選卡片（輸入防抖 120ms，一次批次更新 DOM）
  document.querySelectorAll('input[data-live-filter]').forEach(inp => {
    const items = [...document.querySelectorAll(inp.dataset.liveFilter)];
    if (!items.length) return;
    const count = document.querySelector('[data-live-count]');
    const empty = document.querySelector('[data-live-empty]');
    const texts = items.map(el => el.dataset.q || el.textContent.toLowerCase());
    const run = () => {
      const words = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let n = 0;
      requestAnimationFrame(() => {
        items.forEach((el, i) => {
          const ok = words.every(w => texts[i].includes(w));
          el.classList.toggle('is-hidden', !ok);
          if (ok) n++;
        });
        if (count) count.textContent = n;
        if (empty) empty.hidden = n > 0;
      });
    };
    inp.addEventListener('input', debounce(run, 120));
    inp.form && inp.form.addEventListener('submit', e => e.preventDefault());
    if (inp.value) run();
  });
})();

// 手機選單：按鈕、Esc、點背景都能關
(function () {
  const btn = document.querySelector('.menu-btn');
  if (!btn) return;
  const set = open => {
    document.body.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
  };
  btn.addEventListener('click', () => set(!document.body.classList.contains('nav-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { set(false); btn.focus(); } });
  document.addEventListener('click', e => {
    if (document.body.classList.contains('nav-open') && !e.target.closest('.sidebar, .mainnav, .menu-btn')) set(false);
  });
})();

// ---------- 廠商資料檢索：分頁、搜尋、館區、排序（狀態記在網址，返回時保留） ----------
(function () {
  const root = document.querySelector('[data-dir]');
  if (!root) return;
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const vendors = $$('[data-panel="vendors"] .vcard');
  const products = $$('[data-panel="products"] .pcard');
  const vgrid = $('[data-panel="vendors"]');
  const qInput = $('[data-dir-q]'), sortSel = $('[data-dir-sort]');
  const debutChk = $('[data-dir-debut]'), linkedChk = $('[data-dir-linked]');
  const dots = $$('.ddot'), mhalls = $$('.dhall'), mapCount = $('[data-map-count]');
  function updateMap(vis) {
    const per = {};
    dots.forEach(d => {
      const on = vis.has(d.dataset.vid);
      d.classList.toggle('off', !on);
      if (on) (per[d.dataset.hall] = per[d.dataset.hall] || new Set()).add(d.dataset.vid);
    });
    const max = Math.max(1, ...Object.values(per).map(s => s.size));
    mhalls.forEach(h => {
      const n = per[h.dataset.hall] ? per[h.dataset.hall].size : 0;
      const t = h.querySelector('[data-hall-n]');
      if (t) t.textContent = n;
      h.dataset.level = n ? Math.ceil(n / max * 4) : 0;
      h.classList.toggle('active', S.hall === h.dataset.hall);
    });
    if (mapCount) mapCount.textContent = new Set([...vis]).size;
  }
  const countEl = $('[data-dir-count]'), unitEl = $('[data-dir-unit]'), resetBtn = $('[data-dir-reset]'), emptyEl = $('[data-dir-empty]');
  const P = new URLSearchParams(location.search);
  const S = { tab: P.get('tab') || 'vendors', q: P.get('q') || '', hall: P.get('hall') || '', debut: P.get('debut') === '1',
              linked: P.get('linked') === '1', sort: P.get('sort') || 'booth', kind: P.get('kind') || '' };
  const CN = { 一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9' };
  const norm = w => w.normalize('NFKC').toLowerCase().replace(/([一二三四五六七八九])(?=軸)/g, c => CN[c]);
  const words = () => S.q.trim().split(/\s+/).filter(Boolean).map(norm);
  const hit = (el, ws) => ws.every(w => el.dataset.q.includes(w));
  const inHall = el => !S.hall || el.dataset.halls.split(' ').includes(S.hall);

  function sortVendors() {
    const key = { booth: v => v.dataset.booth, name: v => v.dataset.name,
                  products: v => -(+v.dataset.products), debut: v => -(+v.dataset.debut) }[S.sort] || (v => v.dataset.booth);
    const sorted = [...vendors].sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : (a.dataset.booth < b.dataset.booth ? -1 : 1); });
    const frag = document.createDocumentFragment();
    sorted.forEach(v => frag.appendChild(v));
    vgrid.appendChild(frag);
  }

  function apply() {
    const ws = words();
    let n = 0;
    requestAnimationFrame(() => {
      const isV = S.tab === 'vendors';
      $('[data-panel="vendors"]').hidden = !isV;
      $('[data-panel="products"]').hidden = isV;
      $$('[role=tab]').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === S.tab));
      $$('[data-only]').forEach(e => { e.hidden = e.dataset.only !== S.tab; });
      if (isV) {
        vendors.forEach(v => {
          const ok = hit(v, ws) && inHall(v) && (!S.debut || +v.dataset.debut > 0) && (!S.linked || v.dataset.linked === '1');
          v.hidden = !ok; if (ok) n++;
        });
      } else {
        products.forEach(p => {
          const k = p.dataset.debutkind;
          const ok = hit(p, ws) && inHall(p) && (S.tab !== 'debut' || (k && (!S.kind || k.includes(S.kind))));
          p.hidden = !ok; if (ok) n++;
        });
      }
      const vis = new Set();
      (isV ? vendors : products).forEach(el => { if (!el.hidden && el.dataset.vid) vis.add(el.dataset.vid); });
      updateMap(vis);
      countEl.textContent = n;
      unitEl.textContent = isV ? '家廠商' : S.tab === 'debut' ? '項初公開製品' : '項製品';
      emptyEl.hidden = n > 0;
      resetBtn.hidden = !(S.q || S.hall || S.debut || S.linked || S.kind);
      const u = new URLSearchParams();
      if (S.tab !== 'vendors') u.set('tab', S.tab);
      if (S.q) u.set('q', S.q); if (S.hall) u.set('hall', S.hall);
      if (S.debut) u.set('debut', '1'); if (S.linked) u.set('linked', '1');
      if (S.sort !== 'booth') u.set('sort', S.sort); if (S.kind) u.set('kind', S.kind);
      history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));
    });
  }

  function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function syncUI() {
    qInput.value = S.q; debutChk.checked = S.debut; linkedChk.checked = S.linked; sortSel.value = S.sort;
    $$('[data-hall]').forEach(c => { const on = c.dataset.hall === S.hall; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
    $$('[data-debut-kind]').forEach(c => { const on = c.dataset.debutKind === S.kind; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
  }

  qInput.addEventListener('input', debounce(() => { S.q = qInput.value; apply(); }, 150));
  qInput.addEventListener('keydown', e => { if (e.key === 'Escape') { qInput.value = ''; S.q = ''; apply(); } });
  $$('[role=tab]').forEach(t => t.addEventListener('click', () => { S.tab = t.dataset.tab; apply(); }));
  root.addEventListener('keydown', e => {           // 分頁：左右鍵切換
    if (!e.target.matches('[role=tab]') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = $$('[role=tab]'), i = tabs.indexOf(e.target) + (e.key === 'ArrowRight' ? 1 : -1);
    const t = tabs[(i + tabs.length) % tabs.length]; t.focus(); t.click();
  });
  $$('[data-hall]').forEach(c => c.addEventListener('click', () => { S.hall = c.dataset.hall; syncUI(); apply(); }));
  $$('[data-debut-kind]').forEach(c => c.addEventListener('click', () => { S.kind = c.dataset.debutKind; syncUI(); apply(); }));
  debutChk.addEventListener('change', () => { S.debut = debutChk.checked; apply(); });
  linkedChk.addEventListener('change', () => { S.linked = linkedChk.checked; apply(); });
  sortSel.addEventListener('change', () => { S.sort = sortSel.value; sortVendors(); apply(); });
  resetBtn.addEventListener('click', () => { Object.assign(S, { q: '', hall: '', debut: false, linked: false, kind: '' }); syncUI(); apply(); qInput.focus(); });

  // 地圖：點館別篩選（再點一次取消）、鍵盤 Enter／空白鍵
  mhalls.forEach(h => {
    if (!+h.dataset.total) return;
    const pick = () => { S.hall = S.hall === h.dataset.hall ? '' : h.dataset.hall; syncUI(); apply(); };
    h.addEventListener('click', pick);
    h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  // 滑到卡片上 → 地圖上對應的點閃動
  const hot = (vid, on) => { if (vid) root.querySelectorAll(`.ddot[data-vid="${vid}"]`).forEach(d => d.classList.toggle('hot', on)); };
  root.addEventListener('mouseover', e => { const c = e.target.closest('.vcard, .pcard'); if (c && !c.contains(e.relatedTarget)) hot(c.dataset.vid, true); });
  root.addEventListener('mouseout', e => { const c = e.target.closest('.vcard, .pcard'); if (c && !c.contains(e.relatedTarget)) hot(c.dataset.vid, false); });
  root.addEventListener('focusin', e => { const c = e.target.closest('.vcard'); if (c) hot(c.dataset.vid, true); });
  root.addEventListener('focusout', e => { const c = e.target.closest('.vcard'); if (c) hot(c.dataset.vid, false); });

  syncUI();
  if (S.sort !== 'booth') sortVendors();
  apply();
})();

// 廠商頁「回到廠商資料檢索」：從檢索頁點進來就返回原本的搜尋狀態
document.querySelectorAll('[data-back]').forEach(a => a.addEventListener('click', e => {
  try {
    const r = new URL(document.referrer);
    if (r.origin === location.origin && r.pathname.endsWith('/directory')) { e.preventDefault(); history.back(); }
  } catch (_) {}
}));
