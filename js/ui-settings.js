// แท็บตั้งค่า: จัดการหมวด (เพิ่ม/เปลี่ยนชื่อ/ลบ) และ Export JSON/CSV, Import JSON
// ใช้ textContent ทั้งหมด และผูก listener ครั้งเดียวแบบ event delegation
// ระหว่างแก้ชื่อหมวด จะไม่ re-render รายการหมวด (กันทับช่องที่กำลังพิมพ์) แล้ว render ใหม่หลังบันทึกหรือยกเลิก
(function () {
  var MC = window.MoneyCore;
  var M = MC.money;
  var D = MC.data;
  var R = MC.reports;

  var editingId = null; // id หมวดที่กำลังแก้ชื่อ (null = ไม่ได้แก้)

  function $(id) {
    return document.getElementById(id);
  }

  function makeEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function makeBtn(className, text, action, id) {
    var b = makeEl('button', className, text);
    b.type = 'button';
    b.dataset.action = action;
    b.dataset.id = id;
    return b;
  }

  function setError(msg) {
    var el = $('cat-error');
    if (el) el.textContent = msg || '';
  }

  // ---------- render รายการหมวด ----------
  function renderCatList(ul, state, type) {
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    state.categories.forEach(function (c) {
      if (c.type !== type) return;
      var li = makeEl('li', 'cat-item');
      li.dataset.id = c.id;
      li.appendChild(makeEl('span', 'cat-name', c.name));
      li.appendChild(makeBtn('btn btn-small', 'เปลี่ยนชื่อ', 'rename', c.id));
      li.appendChild(makeBtn('btn btn-small btn-danger', 'ลบ', 'delete', c.id));
      ul.appendChild(li);
    });
  }

  function render(state) {
    if (editingId !== null) return; // กำลังแก้ชื่ออยู่ ไม่ทับ
    var ulExp = $('cat-list-expense');
    var ulInc = $('cat-list-income');
    if (ulExp) renderCatList(ulExp, state, 'expense');
    if (ulInc) renderCatList(ulInc, state, 'income');
  }

  function rerender() {
    render(App.getState());
  }

  // ---------- เปลี่ยนชื่อ (แก้ในแถว) ----------
  function findRow(id) {
    var rows = document.querySelectorAll('.cat-item');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].dataset.id === id) return rows[i];
    }
    return null;
  }

  function startEdit(id) {
    if (editingId !== null) cancelEdit();
    var cat = D.findCategory(App.getState(), id);
    var li = findRow(id);
    if (!cat || !li) return;
    editingId = id;
    setError('');
    while (li.firstChild) li.removeChild(li.firstChild);
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'cat-rename-input';
    input.maxLength = 40;
    input.autocomplete = 'off';
    input.value = cat.name;
    input.setAttribute('aria-label', 'ชื่อหมวดใหม่');
    li.appendChild(input);
    li.appendChild(makeBtn('btn btn-small btn-primary', 'บันทึก', 'save', id));
    li.appendChild(makeBtn('btn btn-small', 'ยกเลิก', 'cancel', id));
    input.focus();
    input.select();
  }

  function cancelEdit() {
    editingId = null;
    rerender();
  }

  function saveEdit(id) {
    var li = findRow(id);
    var input = li ? li.querySelector('input[type="text"]') : null;
    if (!input) {
      cancelEdit();
      return;
    }
    var res = D.renameCategory(App.getState(), id, input.value);
    if (!res.ok) {
      setError(res.error);
      input.focus();
      return;
    }
    editingId = null; // ต้องล้างก่อน commit เพื่อให้ render ทำงาน
    if (App.commit(res.state)) {
      setError('');
      App.toast('เปลี่ยนชื่อหมวดแล้ว');
    } else {
      rerender();
    }
  }

  // ---------- ลบ ----------
  function removeCategory(id) {
    if (editingId !== null) cancelEdit();
    var state = App.getState();
    var cat = D.findCategory(state, id);
    if (!cat) return;
    if (!window.confirm('ลบหมวด "' + cat.name + '"?')) return;
    var res = D.deleteCategory(state, id);
    if (!res.ok) {
      setError(res.error);
      App.toast(res.error, 'error');
      return;
    }
    if (App.commit(res.state)) {
      setError('');
      App.toast('ลบหมวดแล้ว');
    }
  }

  function onListClick(ev) {
    var btn = ev.target.closest ? ev.target.closest('button[data-action]') : null;
    if (!btn) return;
    var id = btn.dataset.id;
    var action = btn.dataset.action;
    if (action === 'rename') startEdit(id);
    else if (action === 'delete') removeCategory(id);
    else if (action === 'save') saveEdit(id);
    else if (action === 'cancel') cancelEdit();
  }

  function onListKeydown(ev) {
    var t = ev.target;
    if (!t || t.tagName !== 'INPUT' || editingId === null) return;
    if (ev.key === 'Enter') {
      ev.preventDefault();
      saveEdit(editingId);
    } else if (ev.key === 'Escape' || ev.key === 'Esc') {
      ev.preventDefault();
      cancelEdit();
    }
  }

  // ---------- เพิ่ม ----------
  function onAddSubmit(ev) {
    ev.preventDefault();
    if (editingId !== null) cancelEdit();
    var res = D.addCategory(App.getState(), { type: $('cat-type').value, name: $('cat-name').value });
    if (!res.ok) {
      setError(res.error);
      $('cat-name').focus();
      return;
    }
    if (!App.commit(res.state)) return;
    $('cat-name').value = '';
    setError('');
    App.toast('เพิ่มหมวดแล้ว');
  }

  // ---------- Export ----------
  function exportJSON() {
    App.download(R.backupFileName(new Date()), D.serialize(App.getState()), 'application/json');
  }

  function exportCSV() {
    App.download('money-transactions-' + M.todayISO() + '.csv', R.toCSV(App.getState()), 'text/csv;charset=utf-8');
  }

  // ---------- Import ----------
  function onImportChange(ev) {
    var input = ev.target;
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var result = D.validateImport(String(reader.result));
        if (!result.ok) {
          App.toast('นำเข้าไม่สำเร็จ: ' + result.error, 'error');
          return;
        }
        var n = result.state.transactions.length;
        if (!window.confirm('แทนที่ข้อมูลทั้งหมดในเครื่องนี้? (รายการ ' + n + ' รายการในไฟล์)')) return;
        editingId = null; // ข้อมูลถูกแทนที่ทั้งหมด เลิกแก้ชื่อที่ค้างอยู่
        if (App.commit(result.state, { fromImport: true })) {
          setError('');
          App.toast('นำเข้าข้อมูลแล้ว');
        }
      } finally {
        input.value = '';
      }
    };
    reader.onerror = function () {
      input.value = '';
      App.toast('นำเข้าไม่สำเร็จ: อ่านไฟล์ไม่ได้', 'error');
    };
    reader.readAsText(file, 'utf-8');
  }

  // ---------- ผูก listener ครั้งเดียว ----------
  function bind() {
    ['cat-list-expense', 'cat-list-income'].forEach(function (id) {
      var ul = $(id);
      if (!ul) return;
      ul.addEventListener('click', onListClick);
      ul.addEventListener('keydown', onListKeydown);
    });
    $('cat-form').addEventListener('submit', onAddSubmit);
    $('export-json').addEventListener('click', exportJSON);
    $('export-csv').addEventListener('click', exportCSV);
    $('import-json').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', onImportChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  App.registerView(render);
})();
