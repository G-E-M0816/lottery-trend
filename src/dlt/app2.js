'use strict';

/* ================= 冷热分析 ================= */
function renderHot(n) {
  const c = countArr(n, false);
  const exp = (n > 0 ? n : N) * KF / NF;
  let h = '';
  for (let x = 1; x <= NF; x++) {
    const ratio = c[x] / exp;
    let cls = 'nb';
    if (ratio >= 1.2) cls += ' hot3';
    else if (ratio >= 1.1) cls += ' hot2';
    else if (ratio >= 0.99) cls += ' hot1';
    else if (ratio <= 0.85) cls += ' cold';
    h += '<div class="' + cls + '" title="' + c[x] + ' 次 / 理论 ' + exp.toFixed(0) + ' 次"><b>' + pad(x) + '</b><span>' + c[x] + '</span></div>';
  }
  $('#hotRed').innerHTML = h;

  const order = [];
  for (let x = 1; x <= NF; x++) order.push(x);
  order.sort((a, b) => c[b] - c[a] || a - b);
  $('#hotList').innerHTML = order.slice(0, 5).map(x => '<span class="bub r" title="' + c[x] + '次">' + x + '</span>').join('') +
    '<span class="mut" style="margin-left:4px">' + c[order[0]] + ' 次</span>';
  $('#coldList').innerHTML = order.slice(-5).reverse().map(x => '<span class="bub g" title="' + c[x] + '次">' + x + '</span>').join('') +
    '<span class="mut" style="margin-left:4px">' + c[order[NF - 1]] + ' 次</span>';

  const omOrder = [];
  for (let x = 1; x <= NF; x++) omOrder.push(x);
  omOrder.sort((a, b) => OM_R[b] - OM_R[a] || a - b);
  $('#omitList').innerHTML = omOrder.slice(0, 5).map(x => '<span class="bub g" title="遗漏 ' + OM_R[x] + ' 期">' + x + '</span>').join('') +
    '<span class="mut" style="margin-left:4px">' + OM_R[omOrder[0]] + ' 期</span>';
}

function renderBack(n) {
  const c = countArr(n, true);
  const exp = (n > 0 ? n : N) * KB / NB;
  let h = '';
  for (let x = 1; x <= NB; x++) {
    const ratio = c[x] / exp;
    let cls = 'nb blue';
    if (ratio >= 1.18) cls += ' hot3';
    else if (ratio >= 1.08) cls += ' hot2';
    else if (ratio <= 0.86) cls += ' cold';
    h += '<div class="' + cls + '" title="' + c[x] + ' 次 / 理论 ' + exp.toFixed(0) + ' 次"><b>' + pad(x) + '</b><span>' + c[x] + '</span></div>';
  }
  $('#blueGrid').innerHTML = h;

  const order = [];
  for (let x = 1; x <= NB; x++) order.push(x);
  order.sort((a, b) => c[b] - c[a] || a - b);
  $('#blueHot').innerHTML = order.slice(0, 4).map(x => '<span class="bub b" title="' + c[x] + '次">' + x + '</span>').join('');
  $('#blueCold').innerHTML = order.slice(-4).reverse().map(x => '<span class="bub g" title="' + c[x] + '次">' + x + '</span>').join('');
  $('#blueMeta').textContent = (n > 0 ? '近 ' + n + ' 期' : '全部 ' + N + ' 期') + ' · 理论每号 ' + exp.toFixed(1) + ' 次';
}

function pct(a, b) { return Math.round(a / b * 100); }

function renderForms(n) {
  const f = formStats(n);
  const c = f.count;
  const peak = arr => { let i = 1; for (let k = 1; k < arr.length; k++) if (arr[k] > arr[i]) i = k; return i; };
  const oddPeak = peak(f.oddD), bigPeak = peak(f.bigD);

  const zoneKeys = Object.keys(f.zoneD).sort((a, b) => f.zoneD[b] - f.zoneD[a]);
  const zoneTop = zoneKeys[0], zoneTopN = f.zoneD[zoneTop];

  const sumSorted = f.sums.slice().sort((a, b) => a - b);
  const q1 = sumSorted[Math.floor(sumSorted.length * 0.25)], q3 = sumSorted[Math.floor(sumSorted.length * 0.75)];

  let repTotal = 0, repN = 0;
  f.repD.forEach((v, k) => { repTotal += v * k; repN += v; });
  const inRange = f.sums.filter(x => x >= 75 && x <= 105).length;
  const repHit = c - f.repD[0];

  const cards = [
    { t: '奇偶比（奇:偶）', v: oddPeak + ':' + (KF - oddPeak), bar: pct(f.oddD[oddPeak], c), sub: '占 ' + pct(f.oddD[oddPeak], c) + '%', col: '#ff5a4d' },
    { t: '大小比（大:小）', v: bigPeak + ':' + (KF - bigPeak), bar: pct(f.bigD[bigPeak], c), sub: '大号=18-35，占 ' + pct(f.bigD[bigPeak], c) + '%', col: '#ff8a5c' },
    { t: '三区分布', v: zoneTop, bar: pct(zoneTopN, c), sub: ZONE_TXT + '，占 ' + pct(zoneTopN, c) + '%', col: '#f2c14e' },
    { t: '和值', v: f.avgSum.toFixed(0), bar: pct(inRange, c), sub: '75-105 区间占 ' + pct(inRange, c) + '%，中间半数在 ' + q1 + '-' + q3, col: '#8ab8ff' },
    { t: '连号出现率', v: pct(f.consecDraws, c) + '%', bar: pct(f.consecDraws, c), sub: '平均每期 ' + (f.consecPairs / c).toFixed(2) + ' 组连号', col: '#5a9dff' },
    { t: '与上期重号', v: repN ? (repTotal / repN).toFixed(2) : '0', bar: pct(repHit, c), sub: '平均个数 · 有重号的期数占 ' + pct(repHit, c) + '%', col: '#9d7bff' }
  ];
  $('#formCards').innerHTML = cards.map(k =>
    '<div class="fcard"><div class="ft">' + k.t + '</div><div class="fv">' + k.v + '</div>' +
    '<div class="mini-bar"><i style="width:' + Math.min(100, k.bar) + '%;background:' + k.col + '"></i></div>' +
    '<div class="ft" style="margin-top:5px;margin-bottom:0">' + k.sub + '</div></div>'
  ).join('');
  $('#formLabel').textContent = n > 0 ? '近 ' + n + ' 期' : '全部 ' + N + ' 期';
}

function renderSumDist(n) {
  const f = formStats(n);
  const buckets = {}, keys = [];
  for (let b = 50; b <= 140; b += 10) { buckets[b] = 0; keys.push(b); }
  let below = 0, above = 0;
  f.sums.forEach(s => {
    const b = Math.floor(s / 10) * 10;
    if (b < 50) below++; else if (b > 140) above++;
    else buckets[b]++;
  });
  const max = Math.max.apply(null, keys.map(k => buckets[k]));
  let h = '';
  keys.forEach(k => {
    const v = buckets[k];
    const p = Math.max(2, Math.round(v / max * 100));
    h += '<div class="fb"><em>' + v + '</em><i style="height:' + p + '%"></i><span>' + k + '</span></div>';
  });
  $('#sumBars').innerHTML = h;
  const top = keys.slice().sort((a, b) => buckets[b] - buckets[a])[0];
  $('#sumMeta').textContent = '均值 ' + f.avgSum.toFixed(1) + ' · 最常见 ' + top + '-' + (top + 9) +
    (below || above ? ' · 低于50 共 ' + below + ' 期、高于140 共 ' + above + ' 期未入图' : '');
}

function renderInsight(n) {
  const f = formStats(n);
  const c = f.count;
  const rc = countArr(n, false);
  const order = [];
  for (let x = 1; x <= NF; x++) order.push(x);
  order.sort((a, b) => rc[b] - rc[a]);
  const hottest = order.slice(0, 3), coldest = order.slice(-3).reverse();
  const omOrder = order.slice().sort((a, b) => OM_R[b] - OM_R[a]);

  $('#insight').innerHTML =
    '<p><b>统计口径：</b>' + (n > 0 ? '近 ' + n + ' 期' : '全部 ' + N + ' 期') + '（' + f.count + ' 期数据）· 每个前区号理论出现率 ' + (KF / NF * 100).toFixed(2) + '%，每期平均 ' + (KF / NF * f.count).toFixed(0) + ' 次。</p>' +
    '<p><b>出得最多：</b>' + hottest.map(x => x + ' 号（' + rc[x] + ' 次）').join('、') + '；<b>最少：</b>' + coldest.map(x => x + ' 号（' + rc[x] + ' 次）').join('、') + '。差距在随机波动范围内，不代表下期倾向。</p>' +
    '<p><b>最久未出：</b>' + omOrder.slice(0, 3).map(x => x + ' 号（已 ' + OM_R[x] + ' 期）').join('、') + '；历史最大遗漏记录是 ' + Math.max.apply(null, MX_R.slice(1)) + ' 期。</p>' +
    '<p><b>形态：</b>和值均值 ' + f.avgSum.toFixed(1) + '，连号出现率 ' + pct(f.consecDraws, c) + '%，与上期重号平均 ' + (f.repD.reduce((a, v, k) => a + v * k, 0) / c).toFixed(2) + ' 个；后区两号之和平均 ' + f.avgBSum.toFixed(1) + '。</p>' +
    '<p style="color:#c9a877"><b>提醒：</b>以上全部是"过去发生了什么"，不是"接下来会怎样"。下一期每个号码被抽中的概率完全一样——前区 5/35，后区 2/12。</p>';
}

/* ================= 选号 ================= */
let STRAT = 'mix', CNT = 5, PICKS = [];

function statsFrom(hist) {
  const cnt = new Array(NF + 1).fill(0);
  hist.slice(-100).forEach(d => d.front.forEach(x => cnt[x]++));
  const om = new Array(NF + 1).fill(0), seen = new Array(NF + 1).fill(false);
  let remain = NF;
  for (let i = hist.length - 1; i >= 0 && remain > 0; i--) {
    const s = new Set(hist[i].front);
    for (let x = 1; x <= NF; x++) {
      if (seen[x]) continue;
      if (s.has(x)) { seen[x] = true; remain--; } else om[x]++;
    }
  }
  const cb = new Array(NB + 1).fill(0);
  hist.slice(-100).forEach(d => d.back.forEach(x => cb[x]++));
  const omb = new Array(NB + 1).fill(0), sb = new Array(NB + 1).fill(false);
  let rb = NB;
  for (let i = hist.length - 1; i >= 0 && rb > 0; i--) {
    hist[i].back.forEach(b => { if (!sb[b]) { sb[b] = true; rb--; } });
    for (let x = 1; x <= NB; x++) if (!sb[x]) omb[x]++;
  }
  return { cnt, om, cb, omb };
}

function weights(st, strategy) {
  const w = new Array(NF + 1).fill(1);
  let sumC = 0, sumO = 0;
  for (let x = 1; x <= NF; x++) { sumC += st.cnt[x]; sumO += st.om[x]; }
  const avgC = sumC / NF || 1, avgO = sumO / NF || 1;
  for (let x = 1; x <= NF; x++) {
    const hot = st.cnt[x] / avgC, cold = st.om[x] / avgO;
    if (strategy === 'hot') w[x] = Math.pow(Math.max(0.15, hot), 2.2);
    else if (strategy === 'cold') w[x] = 0.25 + Math.pow(Math.max(0.2, cold), 1.6) * 0.85;
    else if (strategy === 'omit') w[x] = 0.3 + Math.max(0, cold - 1) * 1.5;
    else w[x] = 0.6 + 0.3 * hot + 0.28 * Math.min(cold, 2.2);
  }
  return w;
}

/* 前区抽 5 个不重复 */
function sampleFront(w) {
  const pool = [];
  for (let x = 1; x <= NF; x++) pool.push(x);
  const picked = [];
  while (picked.length < KF) {
    let total = 0;
    for (let i = 0; i < pool.length; i++) total += w[pool[i]];
    let r = Math.random() * total, pick = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {
      r -= w[pool[i]];
      if (r <= 0) { pick = pool[i]; break; }
    }
    picked.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return picked.sort((a, b) => a - b);
}

/* 后区抽 2 个不重复 */
function sampleBack(bw) {
  const pool = [];
  for (let x = 1; x <= NB; x++) pool.push(x);
  const out = [];
  for (let k = 0; k < KB; k++) {
    let total = 0;
    for (let i = 0; i < pool.length; i++) total += bw[pool[i]];
    let r = Math.random() * total, pick = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {
      r -= bw[pool[i]];
      if (r <= 0) { pick = pool[i]; break; }
    }
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out.sort((a, b) => a - b);
}

/* 形态评分：越小越好 */
function scoreSet(s, lastFront) {
  const sum = s.reduce((a, b) => a + b, 0);
  const z = [0, 0, 0];
  s.forEach(x => z[zoneOf(x)]++);
  const odd = s.filter(x => x % 2).length;
  const big = s.filter(x => x > 17).length;
  const span = s[KF - 1] - s[0];
  let pairs = 0;
  for (let i = 1; i < KF; i++) if (s[i] === s[i - 1] + 1) pairs++;
  let rep = 0;
  if (lastFront) s.forEach(x => { if (lastFront.indexOf(x) > -1) rep++; });
  const tails = {};
  s.forEach(x => { const t = x % 10; tails[t] = (tails[t] || 0) + 1; });
  const maxTail = Math.max.apply(null, Object.keys(tails).map(k => tails[k]));

  let sc = 0;
  sc += Math.abs(sum - 90) / 20;
  sc += z.reduce((a, c) => a + Math.abs(c - KF / 3), 0) * 0.95;
  sc += Math.pow(Math.abs(odd - KF / 2), 1.5) * 0.55;
  sc += Math.abs(big - KF / 2) * 0.7;
  sc += Math.abs(span - 27) / 8;
  sc += Math.abs(pairs - 0.55) * 0.6;
  if (lastFront) sc += Math.abs(rep - 0.71) * 0.75;
  sc += Math.max(0, maxTail - 2) * 0.5;
  return sc;
}

function genPicks(count, strategy, hist, tries) {
  hist = hist || DATA;
  tries = tries || 900;
  const st = statsFrom(hist);
  const w = weights(st, strategy);
  const lastFront = hist.length ? hist[hist.length - 1].front : null;
  const cands = [];
  for (let t = 0; t < tries; t++) {
    const s = sampleFront(w);
    cands.push({ s: s, sc: scoreSet(s, lastFront) });
  }
  cands.sort((a, b) => a.sc - b.sc);
  const out = [], seen = new Set();
  // 两轮：先要求与已有注最多重合 2 个（5 个号里重合 3 个就很像了），不够再放宽到 3 个
  [2, 3].forEach(maxSame => {
    for (let i = 0; i < cands.length && out.length < count; i++) {
      const k = cands[i].s.join(',');
      if (seen.has(k)) continue;
      let dup = false;
      for (const o of out) {
        let same = 0;
        o.forEach(x => { if (cands[i].s.indexOf(x) > -1) same++; });
        if (same > maxSame) { dup = true; break; }
      }
      if (dup) continue;
      seen.add(k);
      out.push(cands[i].s);
    }
  });

  // 后区权重
  const bw = new Array(NB + 1).fill(1);
  let sb = 0;
  for (let x = 1; x <= NB; x++) sb += st.cb[x];
  const avgB = sb / NB || 1;
  for (let x = 1; x <= NB; x++) {
    const hot = st.cb[x] / avgB;
    if (strategy === 'hot') bw[x] = 0.3 + hot * 1.7;
    else if (strategy === 'cold') bw[x] = 0.3 + st.omb[x] / 8 * 1.6;
    else if (strategy === 'omit') bw[x] = 0.4 + st.omb[x] / 6 * 1.4;
    else bw[x] = 0.7 + hot * 0.4 + st.omb[x] / 11;
  }
  // 后区去重：偶然两次抽到同一对时重抽，避免整页方案看起来一模一样
  const usedBack = new Set();
  return out.map(s => {
    let bk = sampleBack(bw);
    for (let t = 0; t < 6 && usedBack.has(bk.join()); t++) bk = sampleBack(bw);
    usedBack.add(bk.join());
    return { front: s, back: bk };
  });
}

const ST_DESC = {
  mix: '均衡推荐：在"近期出现次数"和"当前遗漏"之间取平衡，同时强制三区各 1-2 个、奇偶 3:2 附近、和值落在 75-105。',
  hot: '追热号：按近 100 期出现频率加权，出得多的号更容易被抽中。注意：热号不会因为"热"而更容易再出。',
  cold: '补冷号：按当前遗漏期数加权，久未出的号权重更高。这不会提高中奖率，只是让号码分布看起来"更该轮到它"。',
  omit: '抓遗漏：只给遗漏超过平均值的号码加权，适合喜欢挑"大冷门"的玩法。'
};

function renderPicks() {
  const box = $('#picks');
  const meta = $('#pickMeta');
  if (!PICKS.length) {
    box.innerHTML = '<div class="empty">点「生成方案」，按所选策略出号<br/>每组都会检查三区分布、奇偶比、和值是否落在常见区间</div>';
    meta.textContent = '';
    $('#btnCopy').disabled = true;
    $('#btnAgain').disabled = true;
    $('#pickSub').textContent = '尚未生成';
    return;
  }
  let h = '';
  PICKS.forEach((p, i) => {
    const sum = p.front.reduce((a, b) => a + b, 0);
    const odd = p.front.filter(x => x % 2).length;
    h += '<div class="tk" style="animation-delay:' + (i * 30) + 'ms">' +
      '<span class="tk-no">' + pad(i + 1) + '</span>' +
      '<div class="balls">' + p.front.map(x => '<span class="ball">' + pad(x) + '</span>').join('') +
      p.back.map(x => '<span class="ball blue">' + pad(x) + '</span>').join('') + '</div>' +
      '<span class="tk-meta">和值 ' + sum + ' · 奇偶 ' + odd + ':' + (KF - odd) + '</span></div>';
  });
  box.innerHTML = h;
  const bet = PICKS.length;
  meta.textContent = bet + ' 注 · 共 ' + (bet * 2) + ' 元';
  $('#pickSub').textContent = bet + ' 注 · ' + ({ mix: '均衡推荐', hot: '追热号', cold: '补冷号', omit: '抓遗漏' })[STRAT];
  $('#btnCopy').disabled = false;
  $('#btnAgain').disabled = false;
  $('#genCost').textContent = (bet * 2) + ' 元';
}

function copyPicks() {
  if (!PICKS.length) { toast('先生成方案'); return; }
  let t = '大乐透 · ' + PICKS.length + ' 注（' + new Date().toLocaleDateString('zh-CN') + '）\n';
  PICKS.forEach((p, i) => {
    t += pad(i + 1) + '  ' + p.front.map(pad).join(' ') + '  +  ' + p.back.map(pad).join(' ') + '\n';
  });
  t += '共 ' + (PICKS.length * 2) + ' 元';
  const done = () => toast('已复制，可直接粘贴');
  const fb = txt => {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    toast(ok ? '已复制，可直接粘贴' : '复制失败，请手动选择');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done).catch(() => fb(t));
  else fb(t);
}

/* ================= 对奖 & 回测 ================= */
/* 大乐透奖级（基本投注，2019 年规则）：一行一个奖级 */
function prizeOf(p, d) {
  let f = 0;
  for (let i = 0; i < KF; i++) if (d.front.indexOf(p.front[i]) > -1) f++;
  let b = 0;
  for (let i = 0; i < KB; i++) if (d.back.indexOf(p.back[i]) > -1) b++;

  let tier = 0, money = 0;
  if (f === 5 && b === 2) { tier = 1; money = d.p1 || 8000000; }
  else if (f === 5 && b === 1) { tier = 2; money = 250000; }
  else if (f === 5 && b === 0) { tier = 3; money = 10000; }
  else if (f === 4 && b === 2) { tier = 4; money = 3000; }
  else if (f === 4 && b === 1) { tier = 5; money = 300; }
  else if (f === 3 && b === 2) { tier = 6; money = 200; }
  else if (f === 4 && b === 0) { tier = 7; money = 100; }
  else if ((f === 3 && b === 1) || (f === 2 && b === 2)) { tier = 8; money = 15; }
  else if ((f === 3 && b === 0) || (f === 1 && b === 2) || (f === 2 && b === 1) || (f === 0 && b === 2)) { tier = 9; money = 5; }
  return { tier, money, f, b };
}

let btBusy = false;
function runBacktest(periods) {
  if (btBusy) return;
  btBusy = true;
  const btn = $('#btnBt');
  btn.disabled = true;
  btn.textContent = '计算中…';
  $('#btResult').innerHTML = '<div class="empty">正在用 ' + periods + ' 期历史数据回测，约需 1-2 秒…</div>';

  setTimeout(() => {
    const per = 5;
    const start = Math.max(0, N - periods);
    let cost = 0, prize = 0, winTickets = 0;
    const tiers = {};
    let costR = 0, prizeR = 0, winR = 0;
    const tiersR = {};

    for (let i = start; i < N; i++) {
      const hist = DATA.slice(0, i);
      const picks = genPicks(per, STRAT, hist, 350);
      const d = DATA[i];
      picks.forEach(p => {
        cost += 2;
        const r = prizeOf(p, d);
        prize += r.money;
        if (r.tier) { tiers[r.tier] = (tiers[r.tier] || 0) + 1; winTickets++; }
      });
      for (let k = 0; k < per; k++) {
        const front = sampleFront(new Array(NF + 1).fill(1));
        const back = sampleBack(new Array(NB + 1).fill(1));
        costR += 2;
        const r = prizeOf({ front, back }, d);
        prizeR += r.money;
        if (r.tier) { tiersR[r.tier] = (tiersR[r.tier] || 0) + 1; winR++; }
      }
    }

    const roi = (prize / cost * 100), roiR = (prizeR / costR * 100);
    const names = { 1: '一等奖', 2: '二等奖', 3: '三等奖', 4: '四等奖', 5: '五等奖', 6: '六等奖', 7: '七等奖', 8: '八等奖', 9: '九等奖' };
    const tierLine = t => Object.keys(names).filter(k => t[k]).map(k => names[k] + ' ' + t[k] + ' 次').join(' · ') || '无';

    // 用"回报率百分点差"判断，而非绝对金额差：投 1000 元差 50 元其实是 5 个百分点，不算打平
    const rd = roi - roiR;
    const cmp = Math.abs(rd) < 6
      ? '两者差不多'
      : (rd > 0 ? '这轮策略略高一点' : '这轮策略反而更低');
    $('#btResult').innerHTML =
      '<div class="bt-res">' +
      '<div class="bt-card"><div class="t">这套策略 · 每期 ' + per + ' 注</div>' +
      '<div class="v" style="color:' + (prize > cost ? '#4ecb8d' : '#ff6a5f') + '">' + roi.toFixed(1) + '%</div>' +
      '<div class="s">投入 ' + cost + ' 元 → 收回 ' + prize.toLocaleString('zh-CN') + ' 元<br/>中奖 ' + winTickets + ' 注 · ' + tierLine(tiers) + '</div></div>' +
      '<div class="bt-card"><div class="t">纯随机 · 同样注数</div>' +
      '<div class="v" style="color:' + (prizeR > costR ? '#4ecb8d' : '#ff6a5f') + '">' + roiR.toFixed(1) + '%</div>' +
      '<div class="s">投入 ' + costR + ' 元 → 收回 ' + prizeR.toLocaleString('zh-CN') + ' 元<br/>中奖 ' + winR + ' 注 · ' + tierLine(tiersR) + '</div></div>' +
      '</div>' +
      '<div class="note" style="margin-top:11px">' +
      '<p><b>怎么读这个结果：</b>' + periods + ' 期共 ' + (periods * per) + ' 注、' + (periods * per * 2) + ' 元投入，两者相差 ' + Math.abs(rd).toFixed(1) + ' 个百分点——' + cmp + '。这点差距来自一两次偶然中奖，把期数改成 50 或 200 再跑，方向就会变。真正稳定的是<b>两者都远低于 100%</b>。</p>' +
      '<p><b>为什么回报只有一两成：</b>大乐透奖金池里超过一半在一等奖，而一等奖在几十期里基本碰不到。剩下的小奖（九等奖 5 元、八等奖 15 元）撑不起投入，所以短期回报会明显低于 51% 的长期返奖水平——换句话说，绝大多数人连"平均亏损"都达不到。二等奖按 25 万估算，不含追加投注和派奖。</p>' +
      '</div>';

    btn.disabled = false;
    btn.textContent = '重新回测';
    btBusy = false;
  }, 60);
}

/* ================= 交互 ================= */
function switchTab(name) {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  ['trend', 'stats', 'pick', 'rhy'].forEach(t => {
    const el = $('#tab-' + t);
    if (el) el.hidden = (t !== name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function init() {
  const lastD = DATA[N - 1];
  $('#metaN').textContent = N;
  $('#metaCode').textContent = lastD.code;
  $('#metaDate').textContent = lastD.date.slice(0, 4) + '-' + lastD.date.slice(4, 6) + '-' + lastD.date.slice(6, 8) + ' 开奖';

  renderTrend($('#trendRed'), false, 30);
  renderTrend($('#trendBlue'), true, 30);
  renderFreqBars($('#freqBars'), countArr(30, false), NF);
  renderSumChart(30);
  renderRecent();

  renderHot(100);
  renderBack(100);
  renderForms(100);
  renderSumDist(100);
  renderInsight(100);

  $('#stDesc').textContent = ST_DESC.mix;
  $('#genCost').textContent = '5 注 = 10 元';
}

/* 事件 */
$$('#tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

$$('#rangeSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#rangeSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  const n = +b.dataset.n;
  renderTrend($('#trendRed'), false, n);
  renderTrend($('#trendBlue'), true, n);
  renderFreqBars($('#freqBars'), countArr(n, false), NF);
  renderSumChart(n);
  $('#freqLabel').textContent = '近 ' + n + ' 期';
  $('#sumRange').textContent = '近 ' + n + ' 期';
}));

$$('#hotSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#hotSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  renderHot(+b.dataset.n);
}));

$$('#formSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#formSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  renderForms(+b.dataset.n);
  renderSumDist(+b.dataset.n);
  renderInsight(+b.dataset.n);
}));

$$('#stSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#stSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  STRAT = b.dataset.s;
  $('#stDesc').textContent = ST_DESC[STRAT];
}));

$$('#cntSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#cntSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  CNT = +b.dataset.c;
  $('#genCost').textContent = CNT + ' 注 = ' + (CNT * 2) + ' 元';
}));

$('#btnGen').addEventListener('click', () => {
  PICKS = genPicks(CNT, STRAT);
  renderPicks();
  toast('已生成 ' + PICKS.length + ' 注');
});
$('#btnAgain').addEventListener('click', () => {
  PICKS = genPicks(CNT, STRAT);
  renderPicks();
  toast('换了一批');
});
$('#btnCopy').addEventListener('click', copyPicks);
$('#btnBt').addEventListener('click', () => {
  const on = $('#btSeg button.on');
  runBacktest(+(on ? on.dataset.p : 100));
});
$$('#btSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#btSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
}));

let _rz;
window.addEventListener('resize', () => {
  clearTimeout(_rz);
  _rz = setTimeout(() => {
    const on = $('#rangeSeg button.on');
    renderSumChart(+(on ? on.dataset.n : 30));
  }, 200);
});

init();
