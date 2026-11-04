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
        rm.onclick = e => { e.stopPropagation(); dt.items.remove(i); render(); };
        li.append(n, s, rm);
        list.appendChild(li);
      });
    }

    zone.add = files => { [...files].forEach(f => dt.items.add(f)); render(); };
    zone.addEventListener('click', e => { if (!e.target.closest('li')) input.click(); });
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
    form.querySelectorAll('button:not([type=button])').forEach(b => { b.disabled = true; b.textContent = '上傳中…'; });
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
