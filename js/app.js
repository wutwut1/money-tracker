// window.App: แกนแอป (แตะ DOM)
// load/save localStorage, เดือนที่เลือก, การ์ดสรุป, รายการ, ฟอร์มเพิ่ม/แก้/ลบ, แท็บ
// API: commit, registerView, onAfterSave, download, toast, getState, getMonth
// ui-*.js โหลดหลังไฟล์นี้และเรียก App.registerView ตอนโหลด (ก่อน init) จึงเก็บไว้เป็นคิว
(function () {
  var STORAGE_KEY = 'money-tracker-v1';
  var TOAST_MS = 3500;
  var MC = window.MoneyCore;
  var M = MC.money;
  var D = MC.data;

  var state = D.createDefaultState();
  var month = M.monthKey(new Date());
  var blockSave = false; // true เมื่อข้อมูลใน localStorage เสีย: ห้ามเขียนทับจนกว่าจะ import
  var ready = false;
  var views = [];
  var afterSaveFns = [];
  var editingId = null; // null = โหมดเพิ่ม
  var toastTimer = null;
  var lastText = null; // ข้อความใน localStorage ตอนที่แท็บนี้โหลดหรือบันทึกล่าสุด ใช้กันเขียนทับข้อมูลจากแท็บอื่น

  function $(id) {
    return document.getElementById(id);
  }

  // ---------- toast ----------
  // kind: 'error' | 'warn' | undefined  opts: {sticky:true} ไม่ซ่อนอัตโนมัติ
  function toast(msg, kind, opts) {
    opts = opts || {};
    var el = $('toast');
    if (!el) return;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    el.textContent = String(msg);
    el.classList.remove('error', 'warn');
    if (kind === 'error' || kind === 'warn') el.classList.add(kind);
    el.classList.add('show');
    if (!opts.sticky) {
      toastTimer = setTimeout(function () {
        el.classList.remove('show');
        toastTimer = null;
      }, TOAST_MS);
    }
  }

  // ---------- storage ----------
  function load() {
    var text = null;
    try {
      text = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      text = null; // อ่านไม่ได้ (เช่น file:// บางเบราว์เซอร์) ใช้ค่าเริ่มต้น
    }
    lastText = text === undefined ? null : text;
    if (text === null || text === undefined) {
      state = D.createDefaultState();
      return;
    }
    var res = D.validateImport(text);
    if (res.ok) {
      state = res.state;
      return;
    }
    state = D.createDefaultState();
    blockSave = true;
    toast('ข้อมูลที่บันทึกไว้ในเครื่องเสีย (' + res.error + ') ระบบจะไม่บันทึกทับ กรุณา Import ไฟล์สำรองในแท็บตั้งค่า', 'error', { sticky: true });
  }

  // บันทึกก่อน ถ้าสำเร็จจึงเปลี่ยน state แล้ว render ทุก view
  // opts: {fromImport:true} ใช้ตอน import เพื่อปลดบล็อกข้อมูลเสีย
  function commit(newState, opts) {
    opts = opts || {};
    if (blockSave && !opts.fromImport) {
      toast('บันทึกไม่ได้ เพราะข้อมูลในเครื่องเสีย กรุณา Import ไฟล์สำรองในแท็บตั้งค่าก่อน', 'error', { sticky: true });
      return false;
    }
    // ถ้ามีแท็บอื่นบันทึกไปแล้วหลังจากแท็บนี้โหลด ห้ามเขียนทับ ให้โหลดข้อมูลล่าสุดแทน
    // (import ตั้งใจแทนที่ทั้งหมดอยู่แล้ว จึงข้ามการเช็คนี้)
    if (!opts.fromImport) {
      var current;
      try { current = window.localStorage.getItem(STORAGE_KEY); } catch (e) { current = lastText; }
      if (current !== lastText) {
        reloadFromStorage();
        toast('ข้อมูลถูกแก้จากแท็บหรือหน้าต่างอื่น โหลดข้อมูลล่าสุดแล้ว กรุณาทำรายการอีกครั้ง', 'warn');
        return false;
      }
    }
    var text = D.serialize(newState);
    try {
      window.localStorage.setItem(STORAGE_KEY, text);
    } catch (e) {
      toast('บันทึกไม่สำเร็จ พื้นที่เก็บข้อมูลเต็ม', 'error');
      return false;
    }
    lastText = text;
    if (opts.fromImport) blockSave = false;
    state = newState;
    renderAll();
    return true;
  }

  function reloadFromStorage() {
    blockSave = false;
    load();
    renderAll();
  }

  // ---------- download ----------
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1000);
  }

  // ---------- render ----------
  // "2026-11-26" -> "26 พ.ย."
  function shortThaiDate(iso) {
    var day = parseInt(iso.slice(8, 10), 10);
    var mon = M.thaiMonthShort(iso.slice(0, 7)).split(' ')[0];
    return day + ' ' + mon;
  }

  function renderHeader() {
    $('month-label').textContent = M.thaiMonthLabel(month);
  }

  function renderSummary() {
    var s = D.monthSummary(state, month);
    $('sum-income').textContent = M.formatBaht(s.income);
    $('sum-expense').textContent = M.formatBaht(s.expense);
    var bal = $('sum-balance');
    bal.textContent = M.formatBaht(s.balance);
    bal.classList.toggle('income', s.balance > 0);
    bal.classList.toggle('expense', s.balance < 0);
  }

  function makeEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function renderList() {
    var list = $('tx-list');
    var txs = D.transactionsOfMonth(state, month);
    while (list.firstChild) list.removeChild(list.firstChild);
    txs.forEach(function (t) {
      var cat = D.findCategory(state, t.categoryId);
      var li = makeEl('li', 'tx-row');
      li.dataset.id = t.id;

      var main = makeEl('div', 'tx-main');
      main.appendChild(makeEl('div', 'tx-category', cat ? cat.name : '-'));
      main.appendChild(makeEl('div', 'tx-meta', shortThaiDate(t.date)));
      if (t.note) main.appendChild(makeEl('div', 'tx-note', t.note));
      li.appendChild(main);

      var isIncome = t.type === 'income';
      li.appendChild(makeEl('span', 'tx-amount ' + (isIncome ? 'income' : 'expense'),
        (isIncome ? '+' : '-') + M.formatBaht(t.amount)));

      var actions = makeEl('div', 'tx-actions');
      var btnEdit = makeEl('button', 'btn btn-small', 'แก้ไข');
      btnEdit.type = 'button';
      btnEdit.dataset.action = 'edit';
      btnEdit.dataset.id = t.id;
      var btnDel = makeEl('button', 'btn btn-small btn-danger', 'ลบ');
      btnDel.type = 'button';
      btnDel.dataset.action = 'delete';
      btnDel.dataset.id = t.id;
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
      li.appendChild(actions);

      list.appendChild(li);
    });
    $('tx-empty').hidden = txs.length > 0;
  }

  function renderAll() {
    renderHeader();
    renderSummary();
    renderList();
    views.forEach(function (fn) {
      try {
        fn(state, month);
      } catch (e) {
        if (window.console) console.error(e);
      }
    });
  }

  function setMonth(key) {
    month = key;
    renderAll();
  }

  // ---------- ฟอร์มรายการ ----------
  function selectedType() {
    return $('tx-type-income').checked ? 'income' : 'expense';
  }

  function fillCategories(type, selectedId) {
    var sel = $('tx-category');
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    state.categories.forEach(function (c) {
      if (c.type !== type) return;
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
    if (selectedId) sel.value = selectedId;
    if (!sel.value && sel.options.length) sel.selectedIndex = 0;
  }

  function clearErrors() {
    $('tx-amount-error').textContent = '';
    $('tx-amount').removeAttribute('aria-invalid');
    $('tx-date').removeAttribute('aria-invalid');
  }

  function openDialog() {
    var dlg = $('tx-dialog');
    if (typeof dlg.showModal === 'function') {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute('open', '');
    }
    $('tx-amount').focus();
  }

  function closeDialog() {
    var dlg = $('tx-dialog');
    if (typeof dlg.close === 'function') {
      if (dlg.open) dlg.close();
    } else {
      dlg.removeAttribute('open');
    }
    editingId = null;
  }

  function openAdd() {
    editingId = null;
    $('tx-form-title').textContent = 'เพิ่มรายการ';
    $('tx-type-expense').checked = true;
    $('tx-type-income').checked = false;
    $('tx-amount').value = '';
    $('tx-date').value = M.todayISO();
    $('tx-note').value = '';
    fillCategories('expense');
    clearErrors();
    openDialog();
  }

  function openEdit(id) {
    var tx = null;
    for (var i = 0; i < state.transactions.length; i++) {
      if (state.transactions[i].id === id) tx = state.transactions[i];
    }
    if (!tx) {
      toast('ไม่พบรายการนี้', 'error');
      return;
    }
    editingId = id;
    $('tx-form-title').textContent = 'แก้ไขรายการ';
    $('tx-type-expense').checked = tx.type === 'expense';
    $('tx-type-income').checked = tx.type === 'income';
    $('tx-amount').value = M.formatPlain(tx.amount); // คำนวณด้วยจำนวนเต็ม ไม่ผ่าน float
    $('tx-date').value = tx.date;
    $('tx-note').value = tx.note || '';
    fillCategories(tx.type, tx.categoryId);
    clearErrors();
    openDialog();
  }

  function onSubmit(ev) {
    ev.preventDefault();
    clearErrors();
    var amt = M.parseAmount($('tx-amount').value);
    if (!amt.ok) {
      $('tx-amount-error').textContent = amt.error;
      $('tx-amount').setAttribute('aria-invalid', 'true');
      $('tx-amount').focus();
      return;
    }
    var date = $('tx-date').value;
    if (!date) {
      $('tx-date').setAttribute('aria-invalid', 'true');
      toast('กรุณาเลือกวันที่', 'error');
      $('tx-date').focus();
      return;
    }
    var input = {
      type: selectedType(),
      amount: amt.value,
      categoryId: $('tx-category').value,
      date: date,
      note: $('tx-note').value
    };
    var res = editingId ? D.updateTransaction(state, editingId, input) : D.addTransaction(state, input);
    if (!res.ok) {
      toast(res.error, 'error');
      return;
    }
    if (!commit(res.state)) return;
    closeDialog();
    var key = M.monthKey(res.transaction.date);
    if (key !== month) setMonth(key);
    var tx = res.transaction;
    afterSaveFns.forEach(function (fn) {
      try {
        fn(tx, state);
      } catch (e) {
        if (window.console) console.error(e);
      }
    });
  }

  function onListClick(ev) {
    var btn = ev.target.closest ? ev.target.closest('button[data-action]') : null;
    if (!btn) return;
    var id = btn.dataset.id;
    if (btn.dataset.action === 'edit') {
      openEdit(id);
    } else if (btn.dataset.action === 'delete') {
      if (!window.confirm('ลบรายการนี้?')) return;
      var res = D.deleteTransaction(state, id);
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      if (commit(res.state)) toast('ลบรายการแล้ว');
    }
  }

  // ---------- แท็บ ----------
  function showTab(name) {
    var btns = document.querySelectorAll('.tab-btn[data-tab]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      var panel = $('panel-' + b.dataset.tab);
      if (panel) panel.hidden = !on;
    }
  }

  // ---------- init ----------
  function init() {
    load();

    $('month-prev').addEventListener('click', function () { setMonth(M.addMonths(month, -1)); });
    $('month-next').addEventListener('click', function () { setMonth(M.addMonths(month, 1)); });
    $('btn-add').addEventListener('click', openAdd);
    $('tx-cancel').addEventListener('click', closeDialog);
    $('tx-dialog').addEventListener('close', function () { editingId = null; });
    $('tx-form').addEventListener('submit', onSubmit);
    $('tx-type-expense').addEventListener('change', function () { fillCategories('expense'); });
    $('tx-type-income').addEventListener('change', function () { fillCategories('income'); });
    $('tx-list').addEventListener('click', onListClick);
    // แท็บอื่นบันทึกข้อมูล → โหลดข้อมูลล่าสุดมาแสดง (e.key === null คือมีการล้าง storage)
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY || e.key === null) reloadFromStorage();
    });

    var tabBtns = document.querySelectorAll('.tab-btn[data-tab]');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].addEventListener('click', function (ev) { showTab(ev.currentTarget.dataset.tab); });
    }
    showTab('list');

    ready = true;
    renderAll();
    document.body.dataset.ready = '1';
  }

  window.App = {
    commit: commit,
    // fn(state, monthKey) ถูกเรียกทุกครั้งที่ renderAll ถ้าลงทะเบียนหลัง init จะเรียกทันที 1 ครั้ง
    registerView: function (fn) {
      if (typeof fn !== 'function') return;
      views.push(fn);
      if (ready) {
        try {
          fn(state, month);
        } catch (e) {
          if (window.console) console.error(e);
        }
      }
    },
    // fn(transaction, state) เรียกหลังเพิ่มหรือแก้รายการสำเร็จ
    onAfterSave: function (fn) {
      if (typeof fn === 'function') afterSaveFns.push(fn);
    },
    download: download,
    toast: toast,
    getState: function () { return state; },
    getMonth: function () { return month; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
