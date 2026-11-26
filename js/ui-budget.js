// ui-budget.js: แท็บงบ (แตะ DOM)
// สถานะงบของหมวดที่ตั้งงบ (แถบ .progress > .bar) ฟอร์มตั้งงบของทุกหมวดรายจ่าย
// และแจ้งเตือนเมื่อบันทึกรายจ่ายแล้วหมวดนั้นเกินงบของเดือน
(function () {
  var MC = window.MoneyCore;
  var M = MC.money;
  var D = MC.data;
  var R = MC.reports;

  var formKey = null; // ลายเซ็นของชุดหมวดรายจ่าย + งบ ที่ใช้สร้างฟอร์มล่าสุด

  function $(id) {
    return document.getElementById(id);
  }

  function makeEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function expenseCategories(state) {
    return state.categories.filter(function (c) { return c.type === 'expense'; });
  }

  // ---------- สถานะงบ ----------
  function renderStatus(state, key) {
    var box = $('budget-status');
    if (!box) return;
    clear(box);
    var list = R.budgetStatus(state, key);
    if (!list.length) {
      box.appendChild(makeEl('p', 'muted', 'ยังไม่ได้ตั้งงบ กรอกงบของแต่ละหมวดด้านล่าง'));
      return;
    }
    list.forEach(function (b) {
      var item = makeEl('div', 'budget-item');
      item.dataset.categoryId = b.categoryId;

      var head = makeEl('div', 'budget-head');
      head.appendChild(makeEl('span', 'budget-name', b.name));
      head.appendChild(makeEl('span', 'budget-used',
        'ใช้ไป ' + M.formatBaht(b.spent) + ' / ' + M.formatBaht(b.budget)));
      item.appendChild(head);

      var progress = makeEl('div', 'progress');
      var bar = makeEl('div', 'bar lv-' + b.level);
      bar.style.width = Math.min(b.percent, 100) + '%';
      progress.appendChild(bar);
      item.appendChild(progress);

      var note = makeEl('div', 'budget-note');
      if (b.over > 0) {
        note.appendChild(makeEl('span', 'over-text', 'เกินงบ ' + M.formatBaht(b.over)));
      } else {
        note.textContent = 'เหลือ ' + M.formatBaht(b.remaining);
      }
      item.appendChild(note);

      box.appendChild(item);
    });
  }

  // ---------- ฟอร์มตั้งงบ ----------
  // รวมงบไว้ด้วย เพื่อให้ฟอร์มตรงกับข้อมูลหลัง import (งบเปลี่ยนได้แค่ตอนบันทึก/import จึงไม่ rebuild ระหว่างพิมพ์)
  function signature(state) {
    var budgets = state.budgets || {};
    return expenseCategories(state).map(function (c) {
      return c.id + '\u0000' + c.name + '\u0000' + (budgets[c.id] || '');
    }).join('\u0001');
  }

  function buildForm(state) {
    var box = $('budget-inputs');
    if (!box) return;
    clear(box);
    var budgets = state.budgets || {};
    expenseCategories(state).forEach(function (c) {
      var row = makeEl('div', 'budget-row');
      var inputId = 'budget-in-' + c.id;

      var label = makeEl('label', null, c.name);
      label.htmlFor = inputId;
      row.appendChild(label);

      var input = document.createElement('input');
      input.type = 'text';
      input.id = inputId;
      input.setAttribute('inputmode', 'decimal');
      input.autocomplete = 'off';
      input.placeholder = '0.00';
      input.dataset.categoryId = c.id;
      var b = budgets[c.id];
      input.value = typeof b === 'number' && b > 0 ? M.formatPlain(b) : ''; // จำนวนเต็ม ไม่ผ่าน float
      input.setAttribute('aria-describedby', inputId + '-error');
      row.appendChild(input);

      var err = makeEl('p', 'error-text');
      err.id = inputId + '-error';
      err.setAttribute('aria-live', 'polite');
      err.style.flex = '1 1 100%'; // ให้ error ขึ้นบรรทัดใหม่ใต้ช่อง
      row.appendChild(err);

      box.appendChild(row);
    });
    formKey = signature(state);
  }

  function renderForm(state) {
    if (signature(state) === formKey) return;
    buildForm(state);
  }

  // "0", "00", "0.0", "0.00" ถือว่าเป็นศูนย์
  function isZeroText(s) {
    return /^0+(\.0{0,2})?$/.test(s);
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var state = window.App.getState();
    var inputs = $('budget-inputs').querySelectorAll('input[data-category-id]');
    var entries = [];
    var firstBad = null;
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var err = $(input.id + '-error');
      if (err) err.textContent = '';
      input.removeAttribute('aria-invalid');
      var text = String(input.value).trim();
      if (text === '' || isZeroText(text)) {
        entries.push({ id: input.dataset.categoryId, amount: null });
        continue;
      }
      var amt = M.parseAmount(text);
      if (!amt.ok) {
        if (err) err.textContent = amt.error;
        input.setAttribute('aria-invalid', 'true');
        if (!firstBad) firstBad = input;
        continue;
      }
      entries.push({ id: input.dataset.categoryId, amount: amt.value });
    }
    if (firstBad) {
      firstBad.focus();
      return;
    }
    var next = state;
    for (var j = 0; j < entries.length; j++) {
      if (!D.findCategory(next, entries[j].id)) continue; // หมวดถูกลบไประหว่างนี้
      var res = D.setBudget(next, entries[j].id, entries[j].amount);
      if (!res.ok) {
        window.App.toast(res.error, 'error');
        return;
      }
      next = res.state;
    }
    if (!window.App.commit(next)) return;
    buildForm(window.App.getState());
    window.App.toast('บันทึกงบแล้ว');
  }

  // ---------- แจ้งเตือนเกินงบ ----------
  function onAfterSave(tx, state) {
    if (!tx || tx.type !== 'expense' || typeof tx.date !== 'string') return;
    var key = tx.date.slice(0, 7);
    if (!R.isOverBudget(state, tx.categoryId, key)) return;
    var list = R.budgetStatus(state, key);
    for (var i = 0; i < list.length; i++) {
      if (list[i].categoryId === tx.categoryId) {
        window.App.toast('หมวด "' + list[i].name + '" เกินงบเดือนนี้แล้ว ' + M.formatBaht(list[i].over), 'warn');
        return;
      }
    }
  }

  function render(state, key) {
    renderStatus(state, key);
    renderForm(state);
  }

  var form = $('budget-form');
  if (form) form.addEventListener('submit', onSubmit);
  window.App.registerView(render);
  window.App.onAfterSave(onAfterSave);
})();
