// ระบบเทสขนาดเล็ก (window.MoneyTest) ใช้ใน tests/test.html
// - test(suite, name, fn) ลงทะเบียนเทส
// - eq / ok / deepEq ใช้ตรวจค่า ถ้าไม่ตรงจะ throw
// - loadError(src) เรียกจาก onerror ของ <script> เมื่อโหลดไฟล์ไม่ได้
// - run(expectedSuites) รันทุกเทส แล้วเขียนผลลงใน <pre id="result">
(function () {
  var tests = [];
  var loadErrors = [];

  function show(v) {
    try {
      return JSON.stringify(v);
    } catch (e) {
      return String(v);
    }
  }

  function test(suite, name, fn) {
    tests.push({ suite: suite, name: name, fn: fn });
  }

  function ok(cond, msg) {
    if (!cond) throw new Error(msg || 'คาดว่าเป็นจริง');
  }

  function eq(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error((msg ? msg + ': ' : '') + 'ได้ ' + show(actual) + ' แต่คาดว่า ' + show(expected));
    }
  }

  function isEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a);
    var kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
      if (!isEqual(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  function deepEq(actual, expected, msg) {
    if (!isEqual(actual, expected)) {
      throw new Error((msg ? msg + ': ' : '') + 'ได้ ' + show(actual) + ' แต่คาดว่า ' + show(expected));
    }
  }

  function loadError(src) {
    loadErrors.push('โหลดสคริปต์ไม่ได้ ' + src);
  }

  // จับ error ตอนโหลดสคริปต์ (เช่น syntax error) ด้วย
  window.addEventListener('error', function (ev) {
    if (ev && ev.message) {
      loadErrors.push('error ตอนโหลด: ' + ev.message + ' (' + (ev.filename || '') + ':' + (ev.lineno || 0) + ')');
    }
  });

  function run(expectedSuites) {
    var lines = [];
    var total = 0;
    var failed = 0;

    loadErrors.forEach(function (m) {
      total++;
      failed++;
      lines.push('FAIL load > script: ' + m);
    });

    (expectedSuites || []).forEach(function (s) {
      var found = tests.some(function (t) { return t.suite === s; });
      if (!found) {
        total++;
        failed++;
        lines.push('FAIL ' + s + ' > ลงทะเบียน: ไม่พบเทสของชุดนี้');
      }
    });

    tests.forEach(function (t) {
      total++;
      try {
        t.fn();
        lines.push('ok   ' + t.suite + ' > ' + t.name);
      } catch (e) {
        failed++;
        lines.push('FAIL ' + t.suite + ' > ' + t.name + ': ' + (e && e.message ? e.message : String(e)));
      }
    });

    if (failed === 0) {
      lines.push('PASS ' + total + '/' + total);
    } else {
      lines.push('FAIL ' + failed + '/' + total);
    }

    var text = lines.join('\n');
    var pre = document.getElementById('result');
    if (pre) pre.textContent = text;
    return { total: total, failed: failed, text: text };
  }

  window.MoneyTest = {
    test: test,
    ok: ok,
    eq: eq,
    deepEq: deepEq,
    loadError: loadError,
    run: run
  };
})();
