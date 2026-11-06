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
