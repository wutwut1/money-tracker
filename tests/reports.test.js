// ชุดเทส reports
(function () {
  var T = window.MoneyTest;
  var D = window.MoneyCore && window.MoneyCore.data;
  var R = window.MoneyCore && window.MoneyCore.reports;
  var S = 'reports';
  var seq = 0;

  function add(state, type, amount, categoryId, date, note) {
    seq++;
    var r = D.addTransaction(state, { type: type, amount: amount, categoryId: categoryId, date: date, note: note || '' }, { id: 't-' + seq, now: seq });
    T.ok(r.ok, 'addTransaction ควรสำเร็จ: ' + r.error);
    return r.state;
  }

  T.test(S, 'pieSegments 30000 + 10000 ได้ 75/25 และมุมรวม 360', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 10000, 'exp-travel', '2026-11-02');
    s = add(s, 'expense', 20000, 'exp-food', '2026-11-03');
    s = add(s, 'expense', 10000, 'exp-food', '2026-11-04');
    s = add(s, 'income', 999999, 'inc-salary', '2026-11-04');
    s = add(s, 'expense', 50000, 'exp-food', '2026-10-30');
    var seg = R.pieSegments(s, '2026-11');
    T.eq(seg.length, 2);
    T.eq(seg[0].categoryId, 'exp-food');
    T.eq(seg[0].name, 'อาหาร');
    T.eq(seg[0].amount, 30000);
    T.eq(seg[0].percent, 75);
    T.eq(seg[1].categoryId, 'exp-travel');
    T.eq(seg[1].percent, 25);
    T.eq(seg[0].startAngle, 0);
    T.eq(seg[0].endAngle, 270);
    T.eq(seg[1].startAngle, 270);
    T.eq(seg[1].endAngle, 360);
    var sum = seg.reduce(function (a, x) { return a + (x.endAngle - x.startAngle); }, 0);
    T.eq(sum, 360, 'มุมรวม');
    T.eq(seg[0].full, false);
    T.ok(seg[0].color && seg[1].color && seg[0].color !== seg[1].color, 'สีต่างกัน');
    var svg = R.pieSvg(seg);
    T.ok(svg.indexOf('viewBox=') >= 0, 'มี viewBox');
    T.ok(!/\swidth="/.test(svg.slice(0, svg.indexOf('>'))) && !/\sheight="/.test(svg.slice(0, svg.indexOf('>'))), 'svg ไม่มี width/height คงที่');
    T.eq((svg.match(/<path/g) || []).length, 2);
    T.ok(svg.indexOf('NaN') < 0, 'ไม่มี NaN');
  });

  T.test(S, 'percent ปัด 1 ตำแหน่ง', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 100, 'exp-food', '2026-11-01');
    s = add(s, 'expense', 100, 'exp-travel', '2026-11-01');
    s = add(s, 'expense', 100, 'exp-fun', '2026-11-01');
    var seg = R.pieSegments(s, '2026-11');
    T.eq(seg[0].percent, 33.3);
    T.eq(String(seg[0].percent), '33.3');
    T.eq(R.formatPercent(75), '75%');
  });

  T.test(S, 'palette มีอย่างน้อย 10 สีที่ไม่ซ้ำ', function () {
    T.ok(R.PALETTE.length >= 10);
    var seen = {};
    R.PALETTE.forEach(function (c) { seen[c.toLowerCase()] = true; });
    T.eq(Object.keys(seen).length, R.PALETTE.length);
  });

  T.test(S, 'หมวดเดียวได้ full และ SVG มี <circle', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 12000, 'exp-food', '2026-11-26');
    var seg = R.pieSegments(s, '2026-11');
    T.eq(seg.length, 1);
    T.eq(seg[0].full, true);
    T.eq(seg[0].percent, 100);
    T.eq(seg[0].endAngle - seg[0].startAngle, 360);
    var svg = R.pieSvg(seg);
    T.ok(svg.indexOf('<circle') >= 0, 'มี circle');
    T.ok(svg.indexOf('<path') < 0, 'ไม่มี path');
    T.ok(svg.indexOf('viewBox=') >= 0, 'มี viewBox');
  });

  T.test(S, 'เดือนว่างได้ [] และ pieSvg ว่าง', function () {
    var s = D.createDefaultState();
    s = add(s, 'income', 12000, 'inc-salary', '2026-11-26');
    T.deepEq(R.pieSegments(s, '2026-11'), []);
    T.deepEq(R.pieSegments(D.createDefaultState(), '2026-11'), []);
    T.eq(R.pieSvg([]), '');
  });

  T.test(S, 'SVG escape ชื่อหมวด', function () {
    var s = D.addCategory(D.createDefaultState(), { type: 'expense', name: 'a<b & "c"' }, { id: 'exp-x' }).state;
    s = add(s, 'expense', 100, 'exp-x', '2026-11-01');
    var one = R.pieSvg(R.pieSegments(s, '2026-11'));
    T.ok(one.indexOf('a&lt;b &amp; &quot;c&quot;') >= 0, 'escape ใน circle: ' + one);
    s = add(s, 'expense', 100, 'exp-food', '2026-11-01');
    var two = R.pieSvg(R.pieSegments(s, '2026-11'));
    T.ok(two.indexOf('a&lt;b &amp; &quot;c&quot;') >= 0, 'escape ใน path');
    T.ok(two.indexOf('a<b') < 0, 'ไม่มี < ดิบ');
    T.eq(R.escapeHtml('<&">'), '&lt;&amp;&quot;&gt;');
  });

  T.test(S, 'barData 6 เดือนลงท้ายด้วยเดือนที่เลือก และข้ามปีได้', function () {
    var s = D.createDefaultState();
    s = add(s, 'income', 1500000, 'inc-salary', '2026-02-25');
    s = add(s, 'expense', 12000, 'exp-food', '2026-02-26');
    s = add(s, 'expense', 3000, 'exp-food', '2025-09-01');
    s = add(s, 'expense', 7000, 'exp-food', '2025-08-31');
    s = add(s, 'expense', 7000, 'exp-food', '2026-03-01');
    var bd = R.barData(s, '2026-02');
    T.deepEq(bd.map(function (d) { return d.key; }), ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
    T.eq(bd[5].label, 'ก.พ. 69');
    T.eq(bd[0].label, 'ก.ย. 68');
    T.deepEq([bd[5].income, bd[5].expense], [1500000, 12000]);
    T.deepEq([bd[0].income, bd[0].expense], [0, 3000]);
    T.deepEq([bd[2].income, bd[2].expense], [0, 0]);
    var svg = R.barSvg(bd);
    T.ok(svg.indexOf('viewBox=') >= 0, 'มี viewBox');
    T.ok(!/\swidth="/.test(svg.slice(0, svg.indexOf('>'))), 'svg ไม่มี width คงที่');
    T.eq((svg.match(/<rect/g) || []).length, 12, '2 แท่งต่อเดือน');
    T.ok(svg.indexOf('ก.พ. 69') >= 0, 'มีป้ายเดือน');
    T.ok(svg.indexOf('NaN') < 0, 'ไม่มี NaN');
  });

  T.test(S, 'barData/barSvg ข้อมูลเป็น 0 ทั้งหมดไม่มี NaN', function () {
    var bd = R.barData(D.createDefaultState(), '2026-11');
    T.eq(bd.length, 6);
    T.eq(bd[5].key, '2026-11');
    bd.forEach(function (d) { T.eq(d.income, 0); T.eq(d.expense, 0); });
    var svg = R.barSvg(bd);
    T.ok(svg.indexOf('NaN') < 0, 'ไม่มี NaN');
    T.ok(svg.indexOf('Infinity') < 0, 'ไม่มี Infinity');
    T.ok(svg.indexOf('height="0"') >= 0, 'แท่งสูง 0');
  });

  function budgetState(spent) {
    var s = D.createDefaultState();
    s = D.setBudget(s, 'exp-food', 100000).state;
    if (spent) s = add(s, 'expense', spent, 'exp-food', '2026-11-10');
    s = add(s, 'expense', 999999, 'exp-food', '2026-10-10'); // เดือนอื่นไม่นับ
    return s;
  }

  T.test(S, 'budgetStatus งบ 100000', function () {
    var b = R.budgetStatus(budgetState(50000), '2026-11');
    T.eq(b.length, 1);
    T.deepEq(b[0], { categoryId: 'exp-food', name: 'อาหาร', spent: 50000, budget: 100000, remaining: 50000, percent: 50, level: 'green', over: 0 });
    T.eq(R.budgetStatus(budgetState(79999), '2026-11')[0].level, 'green', '79.999%');
    T.eq(R.budgetStatus(budgetState(80000), '2026-11')[0].level, 'orange', '80%');
    T.eq(R.budgetStatus(budgetState(85000), '2026-11')[0].level, 'orange', '85%');
    var full = R.budgetStatus(budgetState(100000), '2026-11')[0];
    T.eq(full.level, 'orange', '100%');
    T.eq(full.remaining, 0);
    T.eq(full.over, 0);
    T.eq(R.budgetStatus(budgetState(100001), '2026-11')[0].level, 'red', '100.001%');
    var over = R.budgetStatus(budgetState(120000), '2026-11')[0];
    T.eq(over.level, 'red');
    T.eq(over.over, 20000);
    T.eq(over.remaining, 0);
    T.eq(over.percent, 120);
    var none = R.budgetStatus(budgetState(0), '2026-11')[0];
    T.deepEq([none.spent, none.percent, none.level, none.remaining], [0, 0, 'green', 100000]);
  });

  T.test(S, 'budgetStatus แสดงเฉพาะหมวดที่มีงบ', function () {
    var s = D.createDefaultState();
    T.deepEq(R.budgetStatus(s, '2026-11'), []);
    s = D.setBudget(s, 'exp-travel', 5000).state;
    s = D.setBudget(s, 'exp-food', 9000).state;
    var ids = R.budgetStatus(s, '2026-11').map(function (x) { return x.categoryId; });
    T.deepEq(ids, ['exp-food', 'exp-travel']);
  });

  T.test(S, 'isOverBudget', function () {
    T.eq(R.isOverBudget(budgetState(120000), 'exp-food', '2026-11'), true);
    T.eq(R.isOverBudget(budgetState(100000), 'exp-food', '2026-11'), false);
    T.eq(R.isOverBudget(budgetState(120000), 'exp-travel', '2026-11'), false, 'ไม่มีงบ');
    T.eq(R.isOverBudget(budgetState(0), 'exp-food', '2026-10'), true, 'เดือนอื่น');
  });

  T.test(S, 'csvCell ครอบค่าและกันสูตร', function () {
    T.eq(R.csvCell('a,b'), '"a,b"');
    T.eq(R.csvCell('say "hi"'), '"say ""hi"""');
    T.eq(R.csvCell('บรรทัด\nใหม่'), '"บรรทัด\nใหม่"');
    T.eq(R.csvCell('a\r\nb'), '"a\r\nb"');
    T.eq(R.csvCell('=1+1'), "'=1+1");
    T.eq(R.csvCell('+66'), "'+66");
    T.eq(R.csvCell('-5'), "'-5");
    T.eq(R.csvCell('@x'), "'@x");
    T.eq(R.csvCell('=a,b'), '"\'=a,b"');
    T.eq(R.csvCell('ปกติ'), 'ปกติ');
    T.eq(R.csvCell(''), '');
  });

  T.test(S, 'toCSV: BOM, หัวคอลัมน์, CRLF, เรียงเก่าไปใหม่', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 12000, 'exp-food', '2026-11-26', 'a,b');
    s = add(s, 'income', 1500000, 'inc-salary', '2026-11-01', 'say "hi"');
    s = add(s, 'expense', 5, 'exp-travel', '2026-11-26', 'บรรทัด\nใหม่');
    s = add(s, 'expense', 99, 'exp-fun', '2025-12-31', '=1+1');
    var csv = R.toCSV(s);
    T.eq(csv.charCodeAt(0), 0xFEFF, 'BOM');
    var body = csv.slice(1);
    T.eq(body.split('\r\n')[0], 'วันที่,ประเภท,หมวด,จำนวนเงิน,โน้ต');
    T.ok(/\r\n$/.test(body), 'จบด้วย CRLF');
    var expected = [
      'วันที่,ประเภท,หมวด,จำนวนเงิน,โน้ต',
      "2025-12-31,รายจ่าย,บันเทิง,0.99,'=1+1",
      '2026-11-01,รายรับ,เงินเดือน,15000.00,"say ""hi"""',
      '2026-11-26,รายจ่าย,อาหาร,120.00,"a,b"',
      '2026-11-26,รายจ่าย,เดินทาง,0.05,"บรรทัด\nใหม่"'
    ].join('\r\n') + '\r\n';
    T.eq(body, expected);
    T.ok(csv.indexOf('฿') < 0, 'ไม่มี ฿');
  });

  T.test(S, 'toCSV ไม่มีรายการ ได้แค่หัวคอลัมน์', function () {
    T.eq(R.toCSV(D.createDefaultState()), '﻿วันที่,ประเภท,หมวด,จำนวนเงิน,โน้ต\r\n');
  });

  T.test(S, 'toCSV ไม่แก้ลำดับใน state เดิม', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 1, 'exp-food', '2026-11-26');
    s = add(s, 'expense', 1, 'exp-food', '2026-11-01');
    var before = s.transactions.map(function (t) { return t.id; });
    R.toCSV(s);
    T.deepEq(s.transactions.map(function (t) { return t.id; }), before);
  });

  T.test(S, 'pieSvg: ชิ้นใหญ่เกือบ 360° ยังวาดได้ (จุดต้น/ปลายของ arc แต่ละท่อนไม่ซ้ำ)', function () {
    var s = D.createDefaultState();
    s = add(s, 'expense', 1200000, 'exp-housing', '2026-11-02');
    s = add(s, 'expense', 1, 'exp-food', '2026-11-03');
    var svg = R.pieSvg(R.pieSegments(s, '2026-11'));
    var re = /d="M100 100 L([\d.\-]+) ([\d.\-]+) A90 90 0 0 1 ([\d.\-]+) ([\d.\-]+) A90 90 0 0 1 ([\d.\-]+) ([\d.\-]+) Z"/g;
    var m, n = 0;
    while ((m = re.exec(svg))) {
      n++;
      if (n === 1) { // ชิ้นใหญ่ (เรียงมากไปน้อย) ชิ้นเล็กมากอาจมีจุดซ้ำได้ซึ่งมองไม่เห็นอยู่แล้ว
        T.ok(!(m[1] === m[3] && m[2] === m[4]), 'ท่อนแรกจุดต้นไม่ซ้ำจุดกลาง');
        T.ok(!(m[3] === m[5] && m[4] === m[6]), 'ท่อนสองจุดกลางไม่ซ้ำจุดปลาย');
      }
    }
    T.eq(n, 2, 'มี path 2 ชิ้นตามรูปแบบ 2 ท่อน');
    T.ok(svg.indexOf('NaN') < 0, 'ไม่มี NaN');
  });

  T.test(S, 'backupFileName', function () {
    T.eq(R.backupFileName(new Date(2026, 10, 26)), 'money-backup-2026-11-26.json');
    T.eq(R.backupFileName(new Date(2026, 0, 5, 23, 59)), 'money-backup-2026-01-05.json');
  });
})();
