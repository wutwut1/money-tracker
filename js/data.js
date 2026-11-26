// MoneyCore.data: data model, หมวด, รายการ, สรุป, serialize/import
// ทุกฟังก์ชันที่เปลี่ยนข้อมูลเป็น pure: ไม่แก้ object เดิม คืน {ok:true,state,...} หรือ {ok:false,error}
// ไม่แตะ DOM
window.MoneyCore = window.MoneyCore || {};
(function (MC) {
  var VERSION = 1;
  var TYPES = { income: true, expense: true };

  var DEFAULT_CATEGORIES = [
    { id: 'exp-food', type: 'expense', name: 'อาหาร' },
    { id: 'exp-travel', type: 'expense', name: 'เดินทาง' },
    { id: 'exp-housing', type: 'expense', name: 'ที่พัก/ค่าบ้าน' },
    { id: 'exp-shopping', type: 'expense', name: 'ช้อปปิ้ง' },
    { id: 'exp-bills', type: 'expense', name: 'บิล/สาธารณูปโภค' },
    { id: 'exp-health', type: 'expense', name: 'สุขภาพ' },
    { id: 'exp-fun', type: 'expense', name: 'บันเทิง' },
    { id: 'exp-other', type: 'expense', name: 'อื่นๆ' },
    { id: 'inc-salary', type: 'income', name: 'เงินเดือน' },
    { id: 'inc-side', type: 'income', name: 'รายได้เสริม' },
    { id: 'inc-other', type: 'income', name: 'อื่นๆ' }
  ];

  function money() {
    return MC.money;
  }

  function fail(error) {
    return { ok: false, error: error };
  }

  function newId(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isPositiveAmount(n) {
    return typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
  }

  function copyState(state) {
    var budgets = {};
    Object.keys(state.budgets || {}).forEach(function (k) { budgets[k] = state.budgets[k]; });
    return {
      version: VERSION,
      categories: (state.categories || []).slice(),
      transactions: (state.transactions || []).slice(),
      budgets: budgets
    };
  }

  function findCategory(state, id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i];
    }
    return null;
  }

  function findTransactionIndex(state, id) {
    for (var i = 0; i < state.transactions.length; i++) {
      if (state.transactions[i].id === id) return i;
    }
    return -1;
  }

  function normName(name) {
    return String(name).trim().toLowerCase();
  }

  // ชื่อซ้ำในประเภทเดียวกันหรือไม่ (ไม่นับหมวด exceptId)
  function nameTaken(state, type, name, exceptId) {
    var n = normName(name);
    return state.categories.some(function (c) {
      return c.type === type && c.id !== exceptId && normName(c.name) === n;
    });
  }

  function createDefaultState() {
    return {
      version: VERSION,
      categories: DEFAULT_CATEGORIES.map(function (c) { return { id: c.id, type: c.type, name: c.name }; }),
      transactions: [],
      budgets: {}
    };
  }

  // ตรวจและทำความสะอาดข้อมูลรายการ คืน {ok,value} หรือ {ok:false,error}
  function checkTxInput(state, input) {
    input = input || {};
    if (!TYPES[input.type]) return fail('กรุณาเลือกประเภทรายรับหรือรายจ่าย');
    if (!isPositiveAmount(input.amount)) return fail('จำนวนเงินต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');
    var cat = findCategory(state, input.categoryId);
    if (!cat) return fail('กรุณาเลือกหมวด');
    if (cat.type !== input.type) return fail('หมวดไม่ตรงกับประเภทรายการ');
    if (!money().isValidISODate(input.date)) return fail('วันที่ไม่ถูกต้อง');
    var note = input.note === null || input.note === undefined ? '' : String(input.note).trim();
    return {
      ok: true,
      value: { type: input.type, amount: input.amount, categoryId: input.categoryId, date: input.date, note: note }
    };
  }

  // input: {type, amount(สตางค์), categoryId, date, note}
  // opts: {id, now} ใช้กำหนด id และ createdAt เอง (สำหรับเทส)
  function addTransaction(state, input, opts) {
    opts = opts || {};
    var chk = checkTxInput(state, input);
    if (!chk.ok) return chk;
    var tx = {
      id: opts.id || newId('t-'),
      type: chk.value.type,
      amount: chk.value.amount,
      categoryId: chk.value.categoryId,
      date: chk.value.date,
      note: chk.value.note,
      createdAt: typeof opts.now === 'number' ? opts.now : Date.now()
    };
    var next = copyState(state);
    next.transactions.push(tx);
    return { ok: true, state: next, transaction: tx };
  }

  // แก้รายการ id ด้วย input (field ที่ไม่ส่งมาใช้ค่าเดิม) createdAt คงเดิม
  function updateTransaction(state, id, input) {
    var idx = findTransactionIndex(state, id);
    if (idx < 0) return fail('ไม่พบรายการนี้');
    var old = state.transactions[idx];
    input = input || {};
    var merged = {
      type: 'type' in input ? input.type : old.type,
      amount: 'amount' in input ? input.amount : old.amount,
      categoryId: 'categoryId' in input ? input.categoryId : old.categoryId,
      date: 'date' in input ? input.date : old.date,
      note: 'note' in input ? input.note : old.note
    };
    var chk = checkTxInput(state, merged);
    if (!chk.ok) return chk;
    var tx = {
      id: old.id,
      type: chk.value.type,
      amount: chk.value.amount,
      categoryId: chk.value.categoryId,
      date: chk.value.date,
      note: chk.value.note,
      createdAt: old.createdAt
    };
    var next = copyState(state);
    next.transactions[idx] = tx;
    return { ok: true, state: next, transaction: tx };
  }

  function deleteTransaction(state, id) {
    var idx = findTransactionIndex(state, id);
    if (idx < 0) return fail('ไม่พบรายการนี้');
    var next = copyState(state);
    next.transactions.splice(idx, 1);
    return { ok: true, state: next };
  }

  // input: {type, name}  opts: {id} ใช้กำหนด id เอง (สำหรับเทส)
  function addCategory(state, input, opts) {
    opts = opts || {};
    input = input || {};
    if (!TYPES[input.type]) return fail('กรุณาเลือกประเภทของหมวด');
    var name = input.name === null || input.name === undefined ? '' : String(input.name).trim();
    if (!name) return fail('กรุณาใส่ชื่อหมวด');
    if (nameTaken(state, input.type, name, null)) return fail('มีหมวดชื่อนี้ในประเภทเดียวกันแล้ว');
    var id = opts.id || newId(input.type === 'expense' ? 'exp-' : 'inc-');
    if (findCategory(state, id)) return fail('รหัสหมวดซ้ำ');
    var cat = { id: id, type: input.type, name: name };
    var next = copyState(state);
    next.categories.push(cat);
    return { ok: true, state: next, category: cat };
  }

  function renameCategory(state, id, name) {
    var cat = findCategory(state, id);
    if (!cat) return fail('ไม่พบหมวดนี้');
    var n = name === null || name === undefined ? '' : String(name).trim();
    if (!n) return fail('กรุณาใส่ชื่อหมวด');
    if (nameTaken(state, cat.type, n, id)) return fail('มีหมวดชื่อนี้ในประเภทเดียวกันแล้ว');
    var next = copyState(state);
    next.categories = next.categories.map(function (c) {
      return c.id === id ? { id: c.id, type: c.type, name: n } : c;
    });
    return { ok: true, state: next };
  }

  function deleteCategory(state, id) {
    var cat = findCategory(state, id);
    if (!cat) return fail('ไม่พบหมวดนี้');
    var used = state.transactions.filter(function (t) { return t.categoryId === id; }).length;
    if (used > 0) return fail('ลบหมวด "' + cat.name + '" ไม่ได้ เพราะยังมีรายการใช้อยู่ ' + used + ' รายการ');
    var next = copyState(state);
    next.categories = next.categories.filter(function (c) { return c.id !== id; });
    delete next.budgets[id];
    return { ok: true, state: next };
  }

  // amount เป็นสตางค์ ถ้าว่าง/null/0 คือลบงบ
  function setBudget(state, categoryId, amount) {
    var cat = findCategory(state, categoryId);
    if (!cat) return fail('ไม่พบหมวดนี้');
    if (cat.type !== 'expense') return fail('ตั้งงบได้เฉพาะหมวดรายจ่าย');
    var next = copyState(state);
    if (amount === null || amount === undefined || amount === '' || amount === 0) {
      delete next.budgets[categoryId];
      return { ok: true, state: next };
    }
    if (!isPositiveAmount(amount)) return fail('งบต้องเป็นจำนวนเงินที่มากกว่า 0');
    next.budgets[categoryId] = amount;
    return { ok: true, state: next };
  }

  // รายการของเดือน key ("YYYY-MM") เรียงใหม่ไปเก่า วันเดียวกันใช้ createdAt มากกว่าก่อน
  function transactionsOfMonth(state, key) {
    var prefix = key + '-';
    return state.transactions
      .filter(function (t) { return t.date.indexOf(prefix) === 0; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  function monthSummary(state, key) {
    var income = 0;
    var expense = 0;
    transactionsOfMonth(state, key).forEach(function (t) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });
    return { income: income, expense: expense, balance: income - expense };
  }

  function serialize(state) {
    return JSON.stringify({
      version: VERSION,
      categories: state.categories,
      transactions: state.transactions,
      budgets: state.budgets
    });
  }

  function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  // ตรวจข้อความ JSON แล้วคืน {ok:true,state} (object ใหม่ที่มีเฉพาะ field ที่รู้จัก) หรือ {ok:false,error}
  function validateImport(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return fail('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง');
    }
    if (!isPlainObject(data)) return fail('รูปแบบข้อมูลไม่ถูกต้อง');
    if (data.version !== VERSION) return fail('เวอร์ชันของข้อมูลไม่รองรับ');
    if (!Array.isArray(data.categories)) return fail('ไม่พบรายชื่อหมวด');
    if (!Array.isArray(data.transactions)) return fail('ไม่พบรายการ');
    if (!isPlainObject(data.budgets)) return fail('ข้อมูลงบไม่ถูกต้อง');

    var categories = [];
    // ใช้ object ที่ไม่มี prototype เพื่อให้ id อย่าง "constructor" ไม่ชนกับ Object.prototype
    var catById = Object.create(null);
    var namesSeen = Object.create(null);
    for (var i = 0; i < data.categories.length; i++) {
      var c = data.categories[i];
      var no = 'หมวดลำดับที่ ' + (i + 1);
      if (!isPlainObject(c)) return fail(no + ' ไม่ถูกต้อง');
      if (typeof c.id !== 'string' || !c.id) return fail(no + ' ไม่มีรหัส');
      if (c.id === '__proto__') return fail(no + ' มีรหัสไม่ถูกต้อง');
      if (catById[c.id]) return fail('รหัสหมวดซ้ำ: ' + c.id);
      if (!TYPES[c.type]) return fail(no + ' มีประเภทไม่ถูกต้อง');
      if (typeof c.name !== 'string' || !c.name.trim()) return fail(no + ' ไม่มีชื่อ');
      var nk = c.type + '|' + normName(c.name);
      if (namesSeen[nk]) return fail('ชื่อหมวดซ้ำในประเภทเดียวกัน: ' + c.name);
      namesSeen[nk] = true;
      var cat = { id: c.id, type: c.type, name: c.name.trim() };
      catById[c.id] = cat;
      categories.push(cat);
    }

    var transactions = [];
    var txSeen = Object.create(null);
    for (var j = 0; j < data.transactions.length; j++) {
      var t = data.transactions[j];
      var tn = 'รายการลำดับที่ ' + (j + 1);
      if (!isPlainObject(t)) return fail(tn + ' ไม่ถูกต้อง');
      if (typeof t.id !== 'string' || !t.id) return fail(tn + ' ไม่มีรหัส');
      if (txSeen[t.id]) return fail('รหัสรายการซ้ำ: ' + t.id);
      txSeen[t.id] = true;
      if (!TYPES[t.type]) return fail(tn + ' มีประเภทไม่ถูกต้อง');
      if (!isPositiveAmount(t.amount)) return fail(tn + ' มีจำนวนเงินไม่ถูกต้อง');
      if (!money().isValidISODate(t.date)) return fail(tn + ' มีวันที่ไม่ถูกต้อง');
      var tc = catById[t.categoryId];
      if (typeof t.categoryId !== 'string' || !tc) return fail(tn + ' อ้างถึงหมวดที่ไม่มีอยู่');
      if (tc.type !== t.type) return fail(tn + ' มีหมวดไม่ตรงกับประเภท');
      if (t.note !== undefined && t.note !== null && typeof t.note !== 'string') return fail(tn + ' มีโน้ตไม่ถูกต้อง');
      if (t.createdAt !== undefined && !(typeof t.createdAt === 'number' && isFinite(t.createdAt))) {
        return fail(tn + ' มีเวลาที่สร้างไม่ถูกต้อง');
      }
      transactions.push({
        id: t.id,
        type: t.type,
        amount: t.amount,
        categoryId: t.categoryId,
        date: t.date,
        note: typeof t.note === 'string' ? t.note : '',
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : 0
      });
    }

    var budgets = {};
    var keys = Object.keys(data.budgets);
    for (var k = 0; k < keys.length; k++) {
      var bk = keys[k];
      var bc = catById[bk];
      if (!bc) return fail('งบอ้างถึงหมวดที่ไม่มีอยู่: ' + bk);
      if (bc.type !== 'expense') return fail('ตั้งงบได้เฉพาะหมวดรายจ่าย: ' + bc.name);
      if (!isPositiveAmount(data.budgets[bk])) return fail('งบของหมวด ' + bc.name + ' ไม่ถูกต้อง');
      budgets[bk] = data.budgets[bk];
    }

    return {
      ok: true,
      state: { version: VERSION, categories: categories, transactions: transactions, budgets: budgets }
    };
  }

  MC.data = {
    VERSION: VERSION,
    createDefaultState: createDefaultState,
    addTransaction: addTransaction,
    updateTransaction: updateTransaction,
    deleteTransaction: deleteTransaction,
    addCategory: addCategory,
    renameCategory: renameCategory,
    deleteCategory: deleteCategory,
    setBudget: setBudget,
    findCategory: findCategory,
    transactionsOfMonth: transactionsOfMonth,
    monthSummary: monthSummary,
    serialize: serialize,
    validateImport: validateImport
  };
})(window.MoneyCore);
