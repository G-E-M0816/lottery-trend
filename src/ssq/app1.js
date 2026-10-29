'use strict';

/* ================= 数据 ================= */
const DATA = RAW.map(r => ({ code: r[0], date: String(r[1]), red: r[2], blue: r[3], pool: r[4], p1: r[5] }));
const N = DATA.length;
const pad = n => String(n).padStart(2, '0');
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), 1800);
}
function slice(n) { return n > 0 ? DATA.slice(Math.max(0, N - n)) : DATA; }

/* ================= 基础统计 ================= */
function countArr(n, isBlue) {
  const size = isBlue ? 17 : 34;
  const c = new Array(size).fill(0);
  slice(n).forEach(d => {
    if (isBlue) c[d.blue]++;
    else d.red.forEach(x => c[x]++);
  });
  return c;
}

function omission(isBlue) {
  const size = isBlue ? 17 : 34;
  const om = new Array(size).fill(0);
  const seen = new Array(size).fill(false);
  let remain = size - 1;
  for (let i = N - 1; i >= 0 && remain > 0; i--) {
    const d = DATA[i];
    if (isBlue) {
      if (!seen[d.blue]) { seen[d.blue] = true; remain--; }
      for (let x = 1; x <= 16; x++) if (!seen[x]) om[x]++;
    } else {
      const s = new Set(d.red);
      for (let x = 1; x <= 33; x++) {
        if (seen[x]) continue;
        if (s.has(x)) { seen[x] = true; remain--; }
        else om[x]++;
      }
    }
  }
  return om;
}

/* 历史最大遗漏 */
function maxOmission(isBlue) {
  const size = isBlue ? 17 : 34;
  const mx = new Array(size).fill(0);
  const last = new Array(size).fill(-1);
  for (let i = 0; i < N; i++) {
    const d = DATA[i];
    if (isBlue) {
      const gap = i - last[d.blue] - 1;
      if (gap > mx[d.blue]) mx[d.blue] = gap;
      last[d.blue] = i;
    } else {
      d.red.forEach(x => {
        const gap = i - last[x] - 1;
        if (gap > mx[x]) mx[x] = gap;
        last[x] = i;
      });
    }
  }
  for (let x = 1; x < size; x++) {
    const gap = N - 1 - last[x];
    if (gap > mx[x]) mx[x] = gap;
  }
  return mx;
}

const OM_R = omission(false);
const OM_B = omission(true);
const MX_R = maxOmission(false);
const MX_B = maxOmission(true);
const CNT_ALL_R = countArr(0, false);
const CNT_ALL_B = countArr(0, true);

/* 形态 */
function formStats(n) {
  const arr = slice(n);
  const sums = [], spans = [];
  const oddD = new Array(7).fill(0), bigD = new Array(7).fill(0), repD = new Array(7).fill(0);
  const zoneD = {};
  let consecDraws = 0, consecPairs = 0, prev = null;
  arr.forEach(d => {
    const red = d.red;
    const sum = red.reduce((a, b) => a + b, 0);
    sums.push(sum); spans.push(red[5] - red[0]);
    oddD[red.filter(x => x % 2).length]++;
    bigD[red.filter(x => x > 16).length]++;
    const z = [0, 0, 0];
    red.forEach(x => z[x <= 11 ? 0 : x <= 22 ? 1 : 2]++);
    const key = z.join(':');
    zoneD[key] = (zoneD[key] || 0) + 1;
    let pairs = 0;
    for (let i = 1; i < 6; i++) if (red[i] === red[i - 1] + 1) pairs++;
    consecPairs += pairs;
    if (pairs > 0) consecDraws++;
    if (prev) { let r = 0; red.forEach(x => { if (prev.indexOf(x) > -1) r++; }); repD[r]++; }
    prev = red;
  });
  const count = arr.length || 1;
  return {
    count, sums, spans, oddD, bigD, repD, zoneD, consecDraws, consecPairs,
    avgSum: sums.reduce((a, b) => a + b, 0) / count,
    avgSpan: spans.reduce((a, b) => a + b, 0) / count
  };
}

/* ================= 走势图 ================= */
function renderTrend(el, isBlue, n) {
  const arr = slice(n);
  const size = isBlue ? 16 : 33;
  const last = new Array(size + 1).fill(-1);
  const rows = [];
  arr.forEach((d, i) => {
    const set = new Set(isBlue ? [d.blue] : d.red);
    let cells = '';
    for (let x = 1; x <= size; x++) {
      const z = isBlue ? '' : (x >= 12 && x <= 22 ? 'z2' : '');
      if (set.has(x)) {
        cells += '<div class="tc h ' + z + '"><span>' + pad(x) + '</span></div>';
        last[x] = i;
      } else {
        const g = last[x] < 0 ? i + 1 : i - last[x] - 1;
        cells += '<div class="tc ' + z + '">' + g + '</div>';
      }
    }
    rows.push({ code: d.code, date: d.date, cells });
  });
  let head = '<div class="hdrow"><div class="th">期号</div>';
  for (let x = 1; x <= size; x++) head += '<div class="tc">' + x + '</div>';
  head += '</div>';
  const body = rows.slice().reverse().map(r =>
    '<div class="tr"><div class="th"><b>' + r.code + '</b>' + r.date.slice(4, 6) + '-' + r.date.slice(6, 8) + '</div>' + r.cells + '</div>'
  ).join('');
  el.innerHTML = head + body;
}

function renderFreqBars(el, counts, size) {
  let max = 1;
  for (let x = 1; x <= size; x++) max = Math.max(max, counts[x]);
  let h = '';
  for (let x = 1; x <= size; x++) {
    const v = counts[x];
    const pct = Math.max(3, Math.round(v / max * 100));
    h += '<div class="fb"><em>' + v + '</em><i style="height:' + pct + '%"></i><span>' + x + '</span></div>';
  }
  el.innerHTML = h;
}

function renderSumChart(n) {
  const arr = slice(n);
  const sums = arr.map(d => d.red.reduce((a, b) => a + b, 0));
  const allAvg = formStats(0).avgSum;
  const box = $('#sumChart');
  const W = Math.max(300, Math.round(box.clientWidth || 360));
  const H = Math.round(Math.min(230, Math.max(136, W * 0.26)));
  const L = 30, R = 16, T = 12, B = 18;
  const lo = Math.min.apply(null, sums) - 8, hi = Math.max.apply(null, sums) + 8;
  const x = i => L + (W - L - R) * (sums.length === 1 ? 0.5 : i / (sums.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const pts = sums.map((v, i) => x(i) + ',' + y(v)).join(' ');
  const area = 'M' + L + ',' + (H - B) + ' L' + sums.map((v, i) => x(i) + ',' + y(v)).join(' L') + ' L' + x(sums.length - 1) + ',' + (H - B) + ' Z';

  let grid = '';
  [lo, (lo + hi) / 2, hi].forEach((v, i) => {
    const yy = y(v);
    grid += '<line class="grid" x1="' + L + '" y1="' + yy + '" x2="' + (W - R) + '" y2="' + yy + '"/>';
    grid += '<text x="' + (L - 5) + '" y="' + (yy + 3) + '" text-anchor="end">' + Math.round(v) + '</text>';
  });
  const avgY = y(allAvg);
  // 只标首尾期号
  const first = arr[0], lastD = arr[arr.length - 1];

  const svg =
    '<svg class="chart" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    '<defs><linearGradient id="gsum" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#f2c14e" stop-opacity=".28"/>' +
    '<stop offset="100%" stop-color="#f2c14e" stop-opacity="0"/></linearGradient></defs>' +
    grid +
    '<line class="avg" x1="' + L + '" y1="' + avgY + '" x2="' + (W - R) + '" y2="' + avgY + '"/>' +
    '<path d="' + area + '" fill="url(#gsum)"/>' +
    '<polyline class="ln" points="' + pts + '"/>' +
    sums.map((v, i) => '<circle class="pt" cx="' + x(i) + '" cy="' + y(v) + '" r="2"/>').join('') +
    '<text x="' + L + '" y="' + (H - 4) + '">' + first.code + '</text>' +
    '<text x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">' + lastD.code + '</text>' +
    '<text x="' + (W - R) + '" y="' + (T + 2) + '" text-anchor="end" fill="#a98d3f">虚线 = 历史均值 ' + allAvg.toFixed(1) + '</text>' +
    '</svg>';
  $('#sumChart').innerHTML = svg;
}

function renderRecent() {
  const arr = DATA.slice(-5).reverse();
  let h = '';
  arr.forEach(d => {
    h += '<div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.045);flex-wrap:wrap">' +
      '<div style="flex:0 0 62px;font-size:10.5px;color:#7d8593;line-height:1.2"><b style="display:block;color:#c3cad6;font-size:11px">' + d.code + '</b>' +
      d.date.slice(4, 6) + '月' + d.date.slice(6, 8) + '日</div>' +
      '<div class="balls">' + d.red.map(x => '<span class="ball">' + pad(x) + '</span>').join('') +
      '<span class="ball blue">' + pad(d.blue) + '</span></div></div>';
  });
  $('#recent').innerHTML = h;
}
