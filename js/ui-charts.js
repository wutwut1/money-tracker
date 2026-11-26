// ui-charts.js: แท็บกราฟ (แตะ DOM)
// กราฟวงกลมรายจ่ายแยกหมวด + คำอธิบายสี และกราฟแท่งรายรับ/รายจ่าย 6 เดือน
// ลงทะเบียนกับ App.registerView จึงวาดใหม่ทุกครั้งที่ state หรือเดือนเปลี่ยน
(function () {
  var MC = window.MoneyCore;
  var M = MC.money;
  var R = MC.reports;

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

  function renderPie(state, key) {
    var chart = $('pie-chart');
    var legend = $('pie-legend');
    if (!chart || !legend) return;
    var segments = R.pieSegments(state, key);
    clear(legend);
    if (!segments.length) {
      clear(chart);
      chart.appendChild(makeEl('p', 'muted', 'ยังไม่มีรายจ่าย'));
      return;
    }
    chart.innerHTML = R.pieSvg(segments); // pieSvg escape ข้อความแล้ว
    segments.forEach(function (s) {
      var li = makeEl('li');
      var sw = makeEl('span', 'swatch');
      sw.style.background = s.color;
      li.appendChild(sw);
      li.appendChild(makeEl('span', 'name', s.name));
      li.appendChild(makeEl('span', 'value', M.formatBaht(s.amount)));
      li.appendChild(makeEl('span', 'pct', R.formatPercent(s.percent)));
      legend.appendChild(li);
    });
  }

  function renderBar(state, key) {
    var chart = $('bar-chart');
    if (!chart) return;
    chart.innerHTML = R.barSvg(R.barData(state, key));
    // คำอธิบายสี (รายรับ/รายจ่าย) อยู่ใน p.chart-key ของ index.html แล้ว
  }

  function render(state, key) {
    renderPie(state, key);
    renderBar(state, key);
  }

  window.App.registerView(render);
})();
