// MoneyCore.money: แปลง/จัดรูปแบบเงิน (หน่วยสตางค์) และวันที่/เดือน
// ไม่แตะ DOM
window.MoneyCore = window.MoneyCore || {};
(function (MC) {
  var THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  var THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // แปลงข้อความเป็นสตางค์ คืน {ok:true,value} หรือ {ok:false,error}
  // ไม่คูณ float: แยกส่วนบาทกับสตางค์เป็นสตริง
  function parseAmount(str) {
    var s = (str === null || str === undefined) ? '' : String(str).trim();
    if (s === '') return { ok: false, error: 'กรุณาใส่จำนวนเงิน' };
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      return { ok: false, error: 'จำนวนเงินต้องเป็นตัวเลขบวก และมีทศนิยมไม่เกิน 2 ตำแหน่ง' };
    }
    var parts = s.split('.');
    var frac = parts[1] || '';
    while (frac.length < 2) frac += '0';
    var bahtStr = parts[0].replace(/^0+(?=\d)/, '');
    // กันตัวเลขยาวเกิน MAX_SAFE_INTEGER
    if (bahtStr.length > 14) return { ok: false, error: 'จำนวนเงินมากเกินไป' };
    var value = parseInt(bahtStr, 10) * 100 + parseInt(frac, 10);
    if (!Number.isSafeInteger(value)) return { ok: false, error: 'จำนวนเงินมากเกินไป' };
    if (value <= 0) return { ok: false, error: 'จำนวนเงินต้องมากกว่า 0' };
    return { ok: true, value: value };
  }

  // สตางค์ -> "฿1,250.00" หรือ "-฿120.00"
  function formatBaht(satang) {
    var n = Math.round(Number(satang) || 0);
    var neg = n < 0;
    var abs = Math.abs(n);
    var baht = Math.floor(abs / 100);
    var st = abs % 100;
    var bahtStr = String(baht).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + '฿' + bahtStr + '.' + pad2(st);
  }

  // สตางค์ -> "1250.00" (ไม่มี ฿ ไม่มีคั่นหลักพัน) ใช้ใน CSV/ช่องกรอก
  function formatPlain(satang) {
    var n = Math.round(Number(satang) || 0);
    var neg = n < 0;
    var abs = Math.abs(n);
    return (neg ? '-' : '') + Math.floor(abs / 100) + '.' + pad2(abs % 100);
  }

  // วันที่ local เป็น "YYYY-MM-DD"
  function todayISO(date) {
    var d = date instanceof Date ? date : new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // Date หรือ "YYYY-MM-DD" -> "YYYY-MM" (Date ใช้เวลา local)
  function monthKey(date) {
    if (typeof date === 'string') return date.slice(0, 7);
    var d = date instanceof Date ? date : new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  function splitKey(key) {
    var p = String(key).split('-');
    return { y: parseInt(p[0], 10), m: parseInt(p[1], 10) };
  }

  // "2026-01", -1 -> "2025-12"
  function addMonths(key, n) {
    var k = splitKey(key);
    var idx = k.y * 12 + (k.m - 1) + (n || 0);
    var y = Math.floor(idx / 12);
    var m = idx - y * 12 + 1;
    return y + '-' + pad2(m);
  }

  // "2026-11" -> "พฤศจิกายน 2569"
  function thaiMonthLabel(key) {
    var k = splitKey(key);
    return THAI_MONTHS[k.m - 1] + ' ' + (k.y + 543);
  }

  // "2026-11" -> "พ.ย. 69"
  function thaiMonthShort(key) {
    var k = splitKey(key);
    return THAI_MONTHS_SHORT[k.m - 1] + ' ' + pad2((k.y + 543) % 100);
  }

  // ตรวจว่า "YYYY-MM-DD" เป็นวันที่ที่มีจริง
  function isValidISODate(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    var y = parseInt(str.slice(0, 4), 10);
    var m = parseInt(str.slice(5, 7), 10);
    var d = parseInt(str.slice(8, 10), 10);
    if (m < 1 || m > 12 || d < 1) return false;
    var dt = new Date(y, m - 1, d);
    dt.setFullYear(y); // กันปี 0-99 ถูกตีความเป็น 19xx
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  MC.money = {
    parseAmount: parseAmount,
    formatBaht: formatBaht,
    formatPlain: formatPlain,
    todayISO: todayISO,
    monthKey: monthKey,
    addMonths: addMonths,
    thaiMonthLabel: thaiMonthLabel,
    thaiMonthShort: thaiMonthShort,
    isValidISODate: isValidISODate
  };
})(window.MoneyCore);
