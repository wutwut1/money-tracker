// MoneyCore.reports: ข้อมูลกราฟ, SVG, สถานะงบ, CSV และชื่อไฟล์สำรอง
// กรองข้อมูลจาก state.transactions เอง ไม่แตะ DOM (SVG คืนเป็นสตริง)
window.MoneyCore = window.MoneyCore || {};
(function (MC) {
  // สีแยกกันชัดสำหรับหมวดในกราฟวงกลม (ใช้ตามลำดับของ segment)
  var PALETTE = [
    '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
    '#42d4f4', '#f032e6', '#9a6324', '#469990', '#808000',
    '#000075', '#e6a700'
  ];
  var INCOME_COLOR = '#2e9e4f';
  var EXPENSE_COLOR = '#d64545';

  function money() {
    return MC.money;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ปัดทศนิยม 1 ตำแหน่ง เป็นตัวเลข (75 ไม่ใช่ 75.0)
  function percentOf(part, total) {
    if (!total) return 0;
    return Math.round((part * 1000) / total) / 10;
  }

  // แสดงเปอร์เซ็นต์เป็นข้อความ เช่น "75%" "33.3%"
  function formatPercent(p) {
    return String(p) + '%';
  }

  function inMonth(t, key) {
    return typeof t.date === 'string' && t.date.indexOf(key + '-') === 0;
  }

  function categoryName(state, id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i].name;
    }
    return '';
  }

  function spentByCategory(state, key) {
    var sums = {};
    state.transactions.forEach(function (t) {
      if (t.type === 'expense' && inMonth(t, key)) {
        sums[t.categoryId] = (sums[t.categoryId] || 0) + t.amount;
      }
    });
    return sums;
  }

  // รายจ่ายของเดือน key แยกตามหมวด เรียงยอดมากไปน้อย
  // คืน [{categoryId,name,amount,percent,color,startAngle,endAngle,full}] (มุมเป็นองศา เริ่มที่ 12 นาฬิกา ตามเข็ม)
  function pieSegments(state, key) {
    var sums = spentByCategory(state, key);
    var order = {};
    state.categories.forEach(function (c, i) { order[c.id] = i; });
    var ids = Object.keys(sums).sort(function (a, b) {
      if (sums[b] !== sums[a]) return sums[b] - sums[a];
      return (order[a] === undefined ? 1e9 : order[a]) - (order[b] === undefined ? 1e9 : order[b]);
    });
    var total = 0;
    ids.forEach(function (id) { total += sums[id]; });
    if (total <= 0) return [];
    var cum = 0;
    return ids.map(function (id, i) {
      var start = (cum * 360) / total;
      cum += sums[id];
      var end = i === ids.length - 1 ? 360 : (cum * 360) / total;
      return {
        categoryId: id,
        name: categoryName(state, id),
        amount: sums[id],
        percent: percentOf(sums[id], total),
        color: PALETTE[i % PALETTE.length],
        startAngle: start,
        endAngle: end,
        full: ids.length === 1
      };
    });
  }

  function r3(n) {
    return Math.round(n * 1000) / 1000;
  }

  function polar(cx, cy, r, deg) {
    var rad = ((deg - 90) * Math.PI) / 180;
    return { x: r3(cx + r * Math.cos(rad)), y: r3(cy + r * Math.sin(rad)) };
  }

  // SVG กราฟวงกลม (ไม่มี width/height คงที่) ถ้าไม่มี segment คืน ''
  function pieSvg(segments) {
    if (!segments || !segments.length) return '';
    var cx = 100, cy = 100, r = 90;
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="กราฟวงกลมรายจ่ายแยกตามหมวด">'];
    if (segments.length === 1) {
      var s0 = segments[0];
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + escapeHtml(s0.color) + '">' +
        '<title>' + escapeHtml(s0.name + ' ' + money().formatBaht(s0.amount) + ' ' + formatPercent(s0.percent)) + '</title></circle>');
    } else {
      segments.forEach(function (s) {
        // แบ่ง arc เป็น 2 ท่อนผ่านจุดกึ่งกลางเสมอ (แต่ละท่อน ≤ 180°) กันกรณีจุดต้น/ปลายซ้ำกัน
        // หลังปัดทศนิยมเมื่อชิ้นใหญ่เกือบ 360° ซึ่งทำให้ SVG ไม่วาด arc
        var a = polar(cx, cy, r, s.startAngle);
        var m = polar(cx, cy, r, (s.startAngle + s.endAngle) / 2);
        var b = polar(cx, cy, r, s.endAngle);
        var arc = ' A' + r + ' ' + r + ' 0 0 1 ';
        var d = 'M' + cx + ' ' + cy + ' L' + a.x + ' ' + a.y + arc + m.x + ' ' + m.y + arc + b.x + ' ' + b.y + ' Z';
        parts.push('<path d="' + d + '" fill="' + escapeHtml(s.color) + '" stroke="#ffffff" stroke-width="1">' +
          '<title>' + escapeHtml(s.name + ' ' + money().formatBaht(s.amount) + ' ' + formatPercent(s.percent)) + '</title></path>');
      });
    }
    parts.push('</svg>');
    return parts.join('');
  }

  // 6 เดือนที่ลงท้ายด้วย key: [{key,label,income,expense}] เรียงเก่าไปใหม่
  function barData(state, key) {
    var out = [];
    for (var i = 5; i >= 0; i--) {
      var k = money().addMonths(key, -i);
      out.push({ key: k, label: money().thaiMonthShort(k), income: 0, expense: 0 });
    }
    var idx = {};
    out.forEach(function (o, i) { idx[o.key] = i; });
    state.transactions.forEach(function (t) {
      if (typeof t.date !== 'string') return;
      var j = idx[t.date.slice(0, 7)];
      if (j === undefined) return;
      if (t.type === 'income') out[j].income += t.amount;
      else if (t.type === 'expense') out[j].expense += t.amount;
    });
    return out;
  }

  // SVG กราฟแท่ง รายรับ (เขียว) กับรายจ่าย (แดง) ต่อเดือน ไม่มี width/height คงที่
  function barSvg(data) {
    data = data || [];
    var W = 320, H = 200, top = 10, bottom = 170, chartH = bottom - top;
    var n = data.length || 1;
    var groupW = W / n;
    var barW = Math.min(18, groupW / 3);
    var max = 0;
    data.forEach(function (d) {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    });
    function h(v) {
      return max > 0 ? r3((v / max) * chartH) : 0;
    }
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="กราฟแท่งรายรับรายจ่าย 6 เดือน">'];
    parts.push('<line x1="0" y1="' + bottom + '" x2="' + W + '" y2="' + bottom + '" stroke="#999999" stroke-width="1"/>');
    data.forEach(function (d, i) {
      var cx = groupW * i + groupW / 2;
      var hi = h(d.income);
      var he = h(d.expense);
      var xi = r3(cx - barW - 1);
      var xe = r3(cx + 1);
      parts.push('<rect class="bar-income" x="' + xi + '" y="' + r3(bottom - hi) + '" width="' + r3(barW) + '" height="' + hi + '" fill="' + INCOME_COLOR + '">' +
        '<title>' + escapeHtml(d.label + ' รายรับ ' + money().formatBaht(d.income)) + '</title></rect>');
      parts.push('<rect class="bar-expense" x="' + xe + '" y="' + r3(bottom - he) + '" width="' + r3(barW) + '" height="' + he + '" fill="' + EXPENSE_COLOR + '">' +
        '<title>' + escapeHtml(d.label + ' รายจ่าย ' + money().formatBaht(d.expense)) + '</title></rect>');
      parts.push('<text x="' + r3(cx) + '" y="190" text-anchor="middle" font-size="11" fill="#555555">' + escapeHtml(d.label) + '</text>');
    });
    parts.push('</svg>');
    return parts.join('');
  }

  // ทุกหมวดรายจ่ายที่มีงบ (ตามลำดับหมวด)
  // คืน [{categoryId,name,spent,budget,remaining,percent,level,over}]
  // level: 'green' (<80%), 'orange' (80–100%), 'red' (>100%) เทียบด้วยจำนวนเต็ม
  function budgetStatus(state, key) {
    var sums = spentByCategory(state, key);
    var budgets = state.budgets || {};
    var out = [];
    state.categories.forEach(function (c) {
      if (c.type !== 'expense') return;
      var budget = budgets[c.id];
      if (!(typeof budget === 'number' && budget > 0)) return;
      var spent = sums[c.id] || 0;
      var level;
      if (spent * 100 < budget * 80) level = 'green';
      else if (spent <= budget) level = 'orange';
      else level = 'red';
      out.push({
        categoryId: c.id,
        name: c.name,
        spent: spent,
        budget: budget,
        remaining: Math.max(0, budget - spent),
        percent: percentOf(spent, budget),
        level: level,
        over: Math.max(0, spent - budget)
      });
    });
    return out;
  }

  // หมวดนี้ใช้เกินงบในเดือน key หรือไม่ (ไม่มีงบ = false)
  function isOverBudget(state, categoryId, key) {
    var budget = (state.budgets || {})[categoryId];
    if (!(typeof budget === 'number' && budget > 0)) return false;
    var spent = spentByCategory(state, key)[categoryId] || 0;
    return spent > budget;
  }

  // ค่าหนึ่งช่องของ CSV: กันสูตร (= + - @ ขึ้นต้น เติม ') แล้วครอบ "" ถ้ามี , " หรือขึ้นบรรทัด
  function csvCell(value) {
    var s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // CSV ทุกรายการ เรียงวันที่เก่าไปใหม่ (วันเดียวกันใช้ createdAt น้อยก่อน) มี BOM และขึ้นบรรทัดด้วย CRLF
  function toCSV(state) {
    var rows = ['วันที่,ประเภท,หมวด,จำนวนเงิน,โน้ต'];
    var list = state.transactions.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    list.forEach(function (t) {
      rows.push([
        csvCell(t.date),
        t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
        csvCell(categoryName(state, t.categoryId)),
        money().formatPlain(t.amount),
        csvCell(t.note || '')
      ].join(','));
    });
    return '﻿' + rows.join('\r\n') + '\r\n';
  }

  // "money-backup-YYYY-MM-DD.json" ตามวันที่ local
  function backupFileName(date) {
    return 'money-backup-' + money().todayISO(date) + '.json';
  }

  MC.reports = {
    PALETTE: PALETTE,
    INCOME_COLOR: INCOME_COLOR,
    EXPENSE_COLOR: EXPENSE_COLOR,
    escapeHtml: escapeHtml,
    formatPercent: formatPercent,
    pieSegments: pieSegments,
    pieSvg: pieSvg,
    barData: barData,
    barSvg: barSvg,
    budgetStatus: budgetStatus,
    isOverBudget: isOverBudget,
    csvCell: csvCell,
    toCSV: toCSV,
    backupFileName: backupFileName
  };
})(window.MoneyCore);
