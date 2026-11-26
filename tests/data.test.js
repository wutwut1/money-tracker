// ชุดเทส data
(function () {
  var T = window.MoneyTest;
  var D = window.MoneyCore && window.MoneyCore.data;
  var S = 'data';

  function add(state, type, amount, categoryId, date, id, now, note) {
    var r = D.addTransaction(state, { type: type, amount: amount, categoryId: categoryId, date: date, note: note || '' }, { id: id, now: now });
    T.ok(r.ok, 'addTransaction ' + id + ' ควรสำเร็จ: ' + r.error);
    return r.state;
  }

  T.test(S, 'หมวดเริ่มต้นครบ 8+3', function () {
    var s = D.createDefaultState();
    T.eq(s.version, 1);
    T.deepEq(s.transactions, []);
    T.deepEq(s.budgets, {});
    var exp = s.categories.filter(function (c) { return c.type === 'expense'; }).map(function (c) { return c.name; });
    var inc = s.categories.filter(function (c) { return c.type === 'income'; }).map(function (c) { return c.name; });
    T.deepEq(exp, ['อาหาร', 'เดินทาง', 'ที่พัก/ค่าบ้าน', 'ช้อปปิ้ง', 'บิล/สาธารณูปโภค', 'สุขภาพ', 'บันเทิง', 'อื่นๆ']);
    T.deepEq(inc, ['เงินเดือน', 'รายได้เสริม', 'อื่นๆ']);
    T.eq(D.findCategory(s, 'exp-food').name, 'อาหาร');
    T.eq(D.findCategory(s, 'inc-salary').name, 'เงินเดือน');
  });

  T.test(S, 'createDefaultState คืน object ใหม่ทุกครั้ง', function () {
    var a = D.createDefaultState();
    a.categories[0].name = 'แก้';
    T.eq(D.createDefaultState().categories[0].name, 'อาหาร');
  });

  T.test(S, 'เพิ่มหมวด: ชื่อว่างหรือซ้ำในประเภทเดียวกันถูกปฏิเสธ', function () {
    var s = D.createDefaultState();
    T.eq(D.addCategory(s, { type: 'expense', name: '' }).ok, false, 'ชื่อว่าง');
    T.eq(D.addCategory(s, { type: 'expense', name: '   ' }).ok, false, 'ช่องว่างล้วน');
    var dup = D.addCategory(s, { type: 'expense', name: ' อาหาร ' });
    T.eq(dup.ok, false, 'ซ้ำ');
    T.ok(typeof dup.error === 'string' && dup.error.length > 0, 'มีข้อความ error');
    T.eq(D.addCategory(s, { type: 'other', name: 'x' }).ok, false, 'type ผิด');
  });

  T.test(S, 'เพิ่มหมวด: "อื่นๆ" ข้ามประเภทได้ และ id ใช้ prefix', function () {
    var s = D.createDefaultState();
    var s2 = D.addCategory(s, { type: 'income', name: 'อื่นๆ' });
    T.eq(s2.ok, false, 'อื่นๆ ซ้ำในรายรับ');
    var r = D.addCategory(s, { type: 'expense', name: 'กาแฟ' }, { id: 'exp-coffee' });
    T.ok(r.ok);
    T.eq(r.category.id, 'exp-coffee');
    T.eq(r.state.categories.length, 12);
    T.eq(s.categories.length, 11, 'state เดิมไม่เปลี่ยน');
    var r2 = D.addCategory(s, { type: 'income', name: 'โบนัส' });
    T.ok(/^inc-/.test(r2.category.id), 'id รายรับขึ้นต้น inc-');
    var r3 = D.addCategory(s, { type: 'expense', name: 'ของขวัญ' });
    T.ok(/^exp-/.test(r3.category.id), 'id รายจ่ายขึ้นต้น exp-');
    // หมวดใหม่ชื่อเดียวกับหมวดของอีกประเภทได้
    var r4 = D.addCategory(r.state, { type: 'income', name: 'กาแฟ' }, { id: 'inc-coffee' });
    T.ok(r4.ok, 'ชื่อเดียวกันต่างประเภทได้');
  });

  T.test(S, 'เปลี่ยนชื่อแล้ว categoryId ไม่เปลี่ยน', function () {
    var s = D.addCategory(D.createDefaultState(), { type: 'expense', name: 'กาแฟ' }, { id: 'exp-coffee' }).state;
    s = add(s, 'expense', 6500, 'exp-coffee', '2026-11-20', 't-1', 1);
    var r = D.renameCategory(s, 'exp-coffee', 'คาเฟ่');
    T.ok(r.ok);
    T.eq(D.findCategory(r.state, 'exp-coffee').name, 'คาเฟ่');
    T.eq(r.state.transactions[0].categoryId, 'exp-coffee');
    T.eq(D.findCategory(s, 'exp-coffee').name, 'กาแฟ', 'state เดิมไม่เปลี่ยน');
    T.eq(D.renameCategory(s, 'exp-coffee', '').ok, false, 'ชื่อว่าง');
    T.eq(D.renameCategory(s, 'exp-coffee', 'อาหาร').ok, false, 'ชื่อซ้ำ');
    T.ok(D.renameCategory(s, 'exp-coffee', 'กาแฟ').ok, 'ชื่อเดิมของตัวเองได้');
    T.eq(D.renameCategory(s, 'nope', 'x').ok, false, 'ไม่พบหมวด');
  });

  T.test(S, 'ลบหมวดที่มีรายการไม่ได้ ลบหมวดว่างได้และงบหายด้วย', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 12000, 'exp-food', '2026-11-26', 't-1', 1);
    s = D.setBudget(s, 'exp-food', 100000).state;
    s = D.setBudget(s, 'exp-travel', 50000).state;
    var r = D.deleteCategory(s, 'exp-food');
    T.eq(r.ok, false);
    T.ok(r.error.indexOf('รายการ') >= 0, 'มีเหตุผล: ' + r.error);
    var r2 = D.deleteCategory(s, 'exp-travel');
    T.ok(r2.ok);
    T.eq(D.findCategory(r2.state, 'exp-travel'), null);
    T.ok(!('exp-travel' in r2.state.budgets), 'งบหาย');
    T.eq(r2.state.budgets['exp-food'], 100000);
    T.eq(s.budgets['exp-travel'], 50000, 'state เดิมไม่เปลี่ยน');
  });

  T.test(S, 'setBudget: ว่างหรือ 0 ลบ key และใช้ได้เฉพาะรายจ่าย', function () {
    var s = D.setBudget(D.createDefaultState(), 'exp-food', 100000).state;
    T.deepEq(s.budgets, { 'exp-food': 100000 });
    T.deepEq(D.setBudget(s, 'exp-food', 0).state.budgets, {});
    T.deepEq(D.setBudget(s, 'exp-food', null).state.budgets, {});
    T.deepEq(D.setBudget(s, 'exp-food', '').state.budgets, {});
    T.eq(D.setBudget(s, 'inc-salary', 100).ok, false);
    T.eq(D.setBudget(s, 'exp-food', -5).ok, false);
    T.eq(D.setBudget(s, 'exp-food', 1.5).ok, false);
    T.eq(D.setBudget(s, 'nope', 100).ok, false);
  });

  T.test(S, 'addTransaction ตรวจข้อมูลและใช้ id/now ที่ส่งมา', function () {
    var s = D.createDefaultState();
    var r = D.addTransaction(s, { type: 'expense', amount: 12000, categoryId: 'exp-food', date: '2026-11-26', note: ' ข้าว ' }, { id: 't-x', now: 123 });
    T.ok(r.ok);
    T.deepEq(r.transaction, { id: 't-x', type: 'expense', amount: 12000, categoryId: 'exp-food', date: '2026-11-26', note: 'ข้าว', createdAt: 123 });
    T.eq(s.transactions.length, 0, 'state เดิมไม่เปลี่ยน');
    var auto = D.addTransaction(s, { type: 'expense', amount: 1, categoryId: 'exp-food', date: '2026-11-26' });
    T.ok(/^t-/.test(auto.transaction.id), 'id อัตโนมัติขึ้นต้น t-');
    T.eq(typeof auto.transaction.createdAt, 'number');
    T.eq(auto.transaction.note, '');
    var base = { type: 'expense', amount: 100, categoryId: 'exp-food', date: '2026-11-26' };
    function bad(patch, label) {
      var inp = {};
      Object.keys(base).forEach(function (k) { inp[k] = base[k]; });
      Object.keys(patch).forEach(function (k) { inp[k] = patch[k]; });
      var res = D.addTransaction(s, inp);
      T.eq(res.ok, false, label);
      T.ok(typeof res.error === 'string' && res.error.length > 0, label + ' มี error');
    }
    bad({ amount: 0 }, 'amount 0');
    bad({ amount: -5 }, 'amount ติดลบ');
    bad({ amount: 1.5 }, 'amount ทศนิยม');
    bad({ amount: '100' }, 'amount เป็นสตริง');
    bad({ categoryId: 'inc-salary' }, 'หมวดผิดประเภท');
    bad({ categoryId: 'nope' }, 'หมวดไม่มี');
    bad({ date: '2026-02-30' }, 'วันที่ไม่มีจริง');
    bad({ type: 'x' }, 'type ผิด');
  });

  T.test(S, 'สรุปเดือนได้ {1500000,12000,1488000}', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 12000, 'exp-food', '2026-11-26', 't-1', 1);
    s = add(s, 'income', 1500000, 'inc-salary', '2026-11-25', 't-2', 2);
    s = add(s, 'expense', 99900, 'exp-food', '2026-10-31', 't-3', 3);
    T.deepEq(D.monthSummary(s, '2026-11'), { income: 1500000, expense: 12000, balance: 1488000 });
    T.deepEq(D.monthSummary(s, '2026-10'), { income: 0, expense: 99900, balance: -99900 });
    T.deepEq(D.monthSummary(s, '2026-12'), { income: 0, expense: 0, balance: 0 });
  });

  T.test(S, 'กรองตามเดือนและเรียงใหม่ไปเก่า (วันเดียวกันใช้ createdAt มากกว่าก่อน)', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 100, 'exp-food', '2026-11-05', 'a', 10);
    s = add(s, 'expense', 100, 'exp-food', '2026-11-20', 'b', 5);
    s = add(s, 'expense', 100, 'exp-food', '2026-11-20', 'c', 20);
    s = add(s, 'expense', 100, 'exp-food', '2026-10-31', 'd', 30);
    s = add(s, 'expense', 100, 'exp-food', '2026-12-01', 'e', 40);
    s = add(s, 'income', 100, 'inc-salary', '2026-11-01', 'f', 50);
    var ids = D.transactionsOfMonth(s, '2026-11').map(function (t) { return t.id; });
    T.deepEq(ids, ['c', 'b', 'a', 'f']);
    T.deepEq(D.transactionsOfMonth(s, '2026-10').map(function (t) { return t.id; }), ['d']);
    T.deepEq(D.transactionsOfMonth(s, '2026-09'), []);
    T.deepEq(s.transactions.map(function (t) { return t.id; }), ['a', 'b', 'c', 'd', 'e', 'f'], 'ไม่เรียงทับ array เดิม');
  });

  T.test(S, 'แก้ 12000 เป็น 15000 แล้วสรุปเปลี่ยนตาม', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 12000, 'exp-food', '2026-11-26', 't-1', 1);
    var r = D.updateTransaction(s, 't-1', { amount: 15000 });
    T.ok(r.ok);
    T.eq(D.monthSummary(r.state, '2026-11').expense, 15000);
    T.eq(r.state.transactions[0].createdAt, 1, 'createdAt คงเดิม');
    T.eq(r.state.transactions[0].id, 't-1');
    T.eq(D.monthSummary(s, '2026-11').expense, 12000, 'state เดิมไม่เปลี่ยน');
    T.eq(s.transactions[0].amount, 12000);
    T.eq(D.updateTransaction(s, 't-1', { amount: 0 }).ok, false);
    T.eq(D.updateTransaction(s, 'nope', { amount: 1 }).ok, false);
    var r2 = D.updateTransaction(s, 't-1', { type: 'income', categoryId: 'inc-salary', date: '2026-10-01', note: 'n' });
    T.ok(r2.ok);
    T.deepEq(D.monthSummary(r2.state, '2026-10'), { income: 12000, expense: 0, balance: 12000 });
  });

  T.test(S, 'deleteTransaction', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 12000, 'exp-food', '2026-11-26', 't-1', 1);
    var r = D.deleteTransaction(s, 't-1');
    T.ok(r.ok);
    T.eq(r.state.transactions.length, 0);
    T.eq(s.transactions.length, 1, 'state เดิมไม่เปลี่ยน');
    T.eq(D.deleteTransaction(s, 'nope').ok, false);
  });

  function validJSON() {
    return {
      version: 1,
      categories: [{ id: 'exp-food', type: 'expense', name: 'อาหาร' }, { id: 'inc-salary', type: 'income', name: 'เงินเดือน' }],
      transactions: [{ id: 't-1', type: 'expense', amount: 12000, categoryId: 'exp-food', date: '2026-11-26', note: '', createdAt: 1 }],
      budgets: { 'exp-food': 100000 }
    };
  }

  T.test(S, 'validateImport ไม่รับข้อมูลผิดรูปแบบ', function () {
    function rejects(text, label) {
      var r = D.validateImport(text);
      T.eq(r.ok, false, label);
      T.ok(typeof r.error === 'string' && r.error.length > 0, label + ' มี error');
    }
    function mutate(fn) {
      var d = validJSON();
      fn(d);
      return JSON.stringify(d);
    }
    T.ok(D.validateImport(JSON.stringify(validJSON())).ok, 'ข้อมูลถูกต้องผ่าน');
    rejects('not json', 'not json');
    rejects('{}', '{}');
    rejects('[]', '[]');
    rejects('null', 'null');
    rejects(mutate(function (d) { d.version = 2; }), 'version ผิด');
    rejects(mutate(function (d) { d.version = '1'; }), 'version เป็นสตริง');
    rejects(mutate(function (d) { d.transactions[0].amount = 120.5; }), 'amount ทศนิยม');
    rejects(mutate(function (d) { d.transactions[0].amount = -12000; }), 'amount ติดลบ');
    rejects(mutate(function (d) { d.transactions[0].amount = 0; }), 'amount 0');
    rejects(mutate(function (d) { d.transactions[0].amount = Number.MAX_SAFE_INTEGER + 1; }), 'amount เกิน MAX_SAFE_INTEGER');
    rejects(mutate(function (d) { d.transactions[0].categoryId = 'nope'; }), 'categoryId ไม่มีอยู่');
    rejects(mutate(function (d) { d.transactions[0].categoryId = 'inc-salary'; }), 'categoryId ผิดประเภท');
    rejects(mutate(function (d) { d.transactions[0].date = '2026-02-30'; }), 'วันที่ไม่มีจริง');
    rejects(mutate(function (d) { d.transactions[0].type = 'x'; }), 'type ผิด');
    rejects(mutate(function (d) { d.transactions.push(d.transactions[0]); }), 'id รายการซ้ำ');
    rejects(mutate(function (d) { d.categories.push({ id: 'exp-food', type: 'expense', name: 'อื่น' }); }), 'id หมวดซ้ำ');
    rejects(mutate(function (d) { d.categories.push({ id: 'exp-x', type: 'expense', name: 'อาหาร' }); }), 'ชื่อหมวดซ้ำ');
    rejects(mutate(function (d) { d.categories[0].name = ' '; }), 'ชื่อหมวดว่าง');
    rejects(mutate(function (d) { d.categories = {}; }), 'categories ไม่ใช่ array');
    rejects(mutate(function (d) { d.transactions = null; }), 'transactions ไม่ใช่ array');
    rejects(mutate(function (d) { d.budgets = []; }), 'budgets ไม่ใช่ object');
    rejects(mutate(function (d) { d.budgets = { 'inc-salary': 100 }; }), 'งบหมวดรายรับ');
    rejects(mutate(function (d) { d.budgets = { 'exp-food': 0 }; }), 'งบ 0');
    rejects(mutate(function (d) { d.budgets = { 'exp-food': 10.5 }; }), 'งบทศนิยม');
    rejects(mutate(function (d) { d.budgets = { 'nope': 100 }; }), 'งบหมวดไม่มีอยู่');
    // ชื่อ "อื่นๆ" ข้ามประเภทได้
    T.ok(D.validateImport(mutate(function (d) {
      d.categories.push({ id: 'exp-other', type: 'expense', name: 'อื่นๆ' });
      d.categories.push({ id: 'inc-other', type: 'income', name: 'อื่นๆ' });
    })).ok, 'อื่นๆ ข้ามประเภทได้');
  });

  T.test(S, 'serialize แล้ว validateImport กลับมาได้ข้อมูลเท่าเดิม', function () {
    var s = D.createDefaultState();
    s = D.addCategory(s, { type: 'expense', name: 'กาแฟ "ดำ", <เย็น>' }, { id: 'exp-coffee' }).state;
    s = add(s, 'expense', 12000, 'exp-food', '2026-11-26', 't-1', 1795651200000, 'ข้าว, ไข่');
    s = add(s, 'income', 1500000, 'inc-salary', '2026-11-25', 't-2', 1795651200001);
    s = add(s, 'expense', 6500, 'exp-coffee', '2026-10-01', 't-3', 1795651200002, 'บรรทัด\nใหม่');
    s = D.setBudget(s, 'exp-food', 100000).state;
    var text = D.serialize(s);
    T.eq(typeof text, 'string');
    var r = D.validateImport(text);
    T.ok(r.ok, 'validateImport ผ่าน: ' + r.error);
    T.deepEq(r.state, s);
    T.ok(r.state !== s, 'เป็น object ใหม่');
  });

  T.test(S, 'validateImport: id ที่ตรงกับชื่อใน Object.prototype ใช้ได้ และ __proto__ ถูกปฏิเสธ', function () {
    var ok = D.validateImport(JSON.stringify({
      version: 1,
      categories: [{ id: 'constructor', type: 'expense', name: 'ก' }],
      transactions: [{ id: 'toString', type: 'expense', amount: 100, categoryId: 'constructor', date: '2026-11-01', note: '', createdAt: 1 }],
      budgets: { constructor: 500 }
    }));
    T.ok(ok.ok, 'ควรรับ: ' + ok.error);
    T.eq(ok.state.budgets.constructor, 500);
    var bad = D.validateImport('{"version":1,"categories":[],"transactions":[],"budgets":{"__proto__":5}}');
    T.ok(!bad.ok, 'budgets __proto__ ต้องไม่ผ่าน');
    T.ok(bad.error.indexOf('undefined') < 0, 'ข้อความไม่มี undefined: ' + bad.error);
  });
})();
