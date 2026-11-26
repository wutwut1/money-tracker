// ชุดเทส money
(function () {
  var T = window.MoneyTest;
  var M = window.MoneyCore && window.MoneyCore.money;
  var S = 'money';

  T.test(S, 'parseAmount ไม่รับค่าผิดรูปแบบ', function () {
    ['', '   ', '0', '0.00', '-5', 'abc', '1.234', '1,000', '.5', '5.', '1e3'].forEach(function (s) {
      var r = M.parseAmount(s);
      T.eq(r.ok, false, 'parseAmount(' + JSON.stringify(s) + ')');
      T.ok(typeof r.error === 'string' && r.error.length > 0, 'มีข้อความ error สำหรับ ' + JSON.stringify(s));
    });
    T.eq(M.parseAmount(null).ok, false, 'null');
    T.eq(M.parseAmount(undefined).ok, false, 'undefined');
  });

  T.test(S, 'parseAmount แปลงเป็นสตางค์', function () {
    T.deepEq(M.parseAmount('120'), { ok: true, value: 12000 });
    T.deepEq(M.parseAmount('0.1'), { ok: true, value: 10 });
    T.deepEq(M.parseAmount('0.01'), { ok: true, value: 1 });
    T.deepEq(M.parseAmount(' 1250.5 '), { ok: true, value: 125050 });
    T.deepEq(M.parseAmount('15000'), { ok: true, value: 1500000 });
    T.deepEq(M.parseAmount('0.29'), { ok: true, value: 29 });
    T.deepEq(M.parseAmount('1.15'), { ok: true, value: 115 });
  });

  T.test(S, 'parseAmount ไม่รับตัวเลขที่ใหญ่เกิน', function () {
    T.eq(M.parseAmount('99999999999999999999').ok, false);
  });

  T.test(S, 'formatBaht', function () {
    T.eq(M.formatBaht(10 + 20), '฿0.30');
    T.eq(M.formatBaht(125000), '฿1,250.00');
    T.eq(M.formatBaht(-12000), '-฿120.00');
    T.eq(M.formatBaht(1500000), '฿15,000.00');
    T.eq(M.formatBaht(0), '฿0.00');
    T.eq(M.formatBaht(1488000), '฿14,880.00');
    T.eq(M.formatBaht(123456789), '฿1,234,567.89');
    T.eq(M.formatBaht(5), '฿0.05');
  });

  T.test(S, 'formatPlain', function () {
    T.eq(M.formatPlain(12000), '120.00');
    T.eq(M.formatPlain(125005), '1250.05');
  });

  T.test(S, 'addMonths ข้ามปีได้', function () {
    T.eq(M.addMonths('2026-01', -1), '2025-12');
    T.eq(M.addMonths('2025-12', 1), '2026-01');
    T.eq(M.addMonths('2026-11', -5), '2026-06');
    T.eq(M.addMonths('2026-03', -15), '2024-12');
    T.eq(M.addMonths('2026-03', 0), '2026-03');
  });

  T.test(S, 'thaiMonthLabel และ thaiMonthShort', function () {
    T.eq(M.thaiMonthLabel('2026-11'), 'พฤศจิกายน 2569');
    T.eq(M.thaiMonthLabel('2026-01'), 'มกราคม 2569');
    T.eq(M.thaiMonthShort('2026-11'), 'พ.ย. 69');
    T.eq(M.thaiMonthShort('2025-12'), 'ธ.ค. 68');
  });

  T.test(S, 'todayISO ใช้วันที่ local', function () {
    // 23:30 เวลา local ต้องยังเป็นวันเดิม ไม่เลื่อนตาม UTC
    T.eq(M.todayISO(new Date(2026, 10, 26, 23, 30)), '2026-11-26');
    T.eq(M.todayISO(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
    var now = new Date();
    var expected = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    T.eq(M.todayISO(), expected);
  });

  T.test(S, 'monthKey', function () {
    T.eq(M.monthKey(new Date(2026, 10, 30, 23, 59)), '2026-11');
    T.eq(M.monthKey('2026-02-14'), '2026-02');
  });

  T.test(S, 'isValidISODate', function () {
    T.eq(M.isValidISODate('2026-11-26'), true);
    T.eq(M.isValidISODate('2024-02-29'), true);
    T.eq(M.isValidISODate('2026-02-29'), false);
    T.eq(M.isValidISODate('2026-13-01'), false);
    T.eq(M.isValidISODate('2026-1-01'), false);
    T.eq(M.isValidISODate(''), false);
    T.eq(M.isValidISODate(20261126), false);
  });
})();
