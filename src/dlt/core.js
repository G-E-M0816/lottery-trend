/* ============================================================
   节奏推演核心（纯计算，无 DOM）· 大乐透版
   给每个号算一个"节奏分"，四个分量加权
     遗漏张力  om  / 全盘平均遗漏
     近期热度  cnt / 窗口期望
     短期动能  近5期出现 / 期望
     间隔节奏  om  / 该号自己近几次出现的间隔中位数
   tone: 1=跟热  3=稳健  5=抓冷
   前区 35 选 5，后区 12 选 2
   ============================================================ */

const LN2 = Math.LN2;
const lg2 = v => Math.log(1 + Math.max(0, v)) / LN2;   // v=1 → 1，压缩极端值

/* 前区 35，后区 12，避免和 app 里的常量重名 */
const RF = 35, RB = 12;

function rhyStats(DATA, win, end) {
  end = (end == null) ? DATA.length : end;
  const cnt = new Array(RF + 1).fill(0);
  const from = Math.max(0, end - win);
  for (let i = from; i < end; i++) DATA[i].front.forEach(x => cnt[x]++);

  // 当前遗漏
  const om = new Array(RF + 1).fill(0), seen = new Array(RF + 1).fill(false);
  let remain = RF;
  for (let i = end - 1; i >= 0 && remain > 0; i--) {
    const s = DATA[i].front;
    for (let x = 1; x <= RF; x++) {
      if (seen[x]) continue;
      if (s.indexOf(x) > -1) { seen[x] = true; remain--; } else om[x]++;
    }
  }

  // 近 5 期
  const c5 = new Array(RF + 1).fill(0);
  for (let i = Math.max(0, end - 5); i < end; i++) DATA[i].front.forEach(x => c5[x]++);

  // 每个号自己近 6 次出现的间隔（空档期数）中位数
  const gap = new Array(RF + 1).fill(0);
  for (let x = 1; x <= RF; x++) {
    const pos = [];
    for (let i = end - 1; i >= 0 && pos.length < 6; i--) {
      if (DATA[i].front.indexOf(x) > -1) pos.push(i);
    }
    if (pos.length >= 4) {
      const ds = [];
      for (let i = 1; i < pos.length; i++) ds.push(pos[i - 1] - pos[i] - 1);
      ds.sort((a, b) => a - b);
      gap[x] = ds[Math.floor(ds.length / 2)];
    }
  }

  // 后区（12 个，每期出 2 个）
  const cb = new Array(RB + 1).fill(0);
  for (let i = from; i < end; i++) DATA[i].back.forEach(x => cb[x]++);
  const omb = new Array(RB + 1).fill(0), sb = new Array(RB + 1).fill(false);
  let rb = RB;
  for (let i = end - 1; i >= 0 && rb > 0; i--) {
    DATA[i].back.forEach(b => { if (!sb[b]) { sb[b] = true; rb--; } });
    for (let x = 1; x <= RB; x++) if (!sb[x]) omb[x]++;
  }
  const gapB = new Array(RB + 1).fill(0);
  for (let x = 1; x <= RB; x++) {
    const pos = [];
    for (let i = end - 1; i >= 0 && pos.length < 6; i--) {
      if (DATA[i].back.indexOf(x) > -1) pos.push(i);
    }
    if (pos.length >= 4) {
      const ds = [];
      for (let i = 1; i < pos.length; i++) ds.push(pos[i - 1] - pos[i] - 1);
      ds.sort((a, b) => a - b);
      gapB[x] = ds[Math.floor(ds.length / 2)];
    }
  }

  // 窗口和值
  let sum = 0, sum2 = 0, n = 0;
  for (let i = from; i < end; i++) {
    const s = DATA[i].front.reduce((a, b) => a + b, 0);
    sum += s; sum2 += s * s; n++;
  }
  const avgSum = n ? sum / n : 90;
  const sdSum = n > 1 ? Math.sqrt(Math.max(1, sum2 / n - avgSum * avgSum)) : 16;

  return { cnt, om, c5, gap, cb, omb, gapB, avgSum, sdSum, win: n, from, end };
}

function rhyScores(st, tone) {
  const t = (Math.min(5, Math.max(1, tone)) - 1) / 4;      // 0..1
  const wHeat = 0.45 - 0.27 * t;
  const wMom  = 0.30 - 0.16 * t;
  const wGap  = 0.15 + 0.18 * t;
  const wOm   = 0.10 + 0.25 * t;

  let omSum = 0, cSum = 0;
  for (let x = 1; x <= RF; x++) { omSum += st.om[x]; cSum += st.cnt[x]; }
  const omAvg = (omSum / RF) || 6;
  const cAvg = (cSum / RF) || (st.win * 5 / RF || 1);

  const raw = {}, det = {};
  for (let x = 1; x <= RF; x++) {
    const tOm = st.om[x] / omAvg;
    const tHt = st.cnt[x] / cAvg;
    const tMo = st.c5[x] / (5 * 5 / RF);
    // 间隔项：遗漏相对"自己的惯常间隔"越到位分越高，到点后饱和
    const g = st.gap[x] > 0 ? st.om[x] / Math.max(1, st.gap[x]) : 1;
    const tGap = 1 - Math.exp(-Math.pow(Math.max(0, g), 1.3));
    raw[x] = { om: lg2(tOm), ht: lg2(tHt), mo: lg2(tMo), gap: tGap };
    det[x] = { tOm, tHt, tMo, tGap };
  }
  // 标准化：四个分量量纲差很多，不做 z-score 的话"权重"形同虚设
  const keys = ['om', 'ht', 'mo', 'gap'];
  const zs = {};
  keys.forEach(k => {
    const v = [];
    for (let x = 1; x <= RF; x++) v.push(raw[x][k]);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length) || 1;
    zs[k] = new Array(RF + 1).fill(0);
    for (let x = 1; x <= RF; x++) zs[k][x] = (raw[x][k] - m) / sd;
  });
  const sc = new Array(RF + 1).fill(0);
  for (let x = 1; x <= RF; x++) {
    sc[x] = wOm * zs.om[x] + wHeat * zs.ht[x] + wMom * zs.mo[x] + wGap * zs.gap[x];
  }
  return { sc, det, w: { wOm, wHeat, wMom, wGap }, omAvg, cAvg };
}

function rhyBackScores(st, tone) {
  const t = (Math.min(5, Math.max(1, tone)) - 1) / 4;
  const wHeat = 0.42 - 0.30 * t, wGap = 0.16 + 0.24 * t, wOm = 0.10 + 0.26 * t;
  let omSum = 0, cSum = 0;
  for (let x = 1; x <= RB; x++) { omSum += st.omb[x]; cSum += st.cb[x]; }
  const omAvg = (omSum / RB) || 12;
  const cAvg = (cSum / RB) || (st.win * 2 / RB || 1);
  const sc = new Array(RB + 1).fill(0);
  for (let x = 1; x <= RB; x++) {
    const tOm = st.omb[x] / omAvg;
    const tHt = st.cb[x] / cAvg;
    const tGap = st.gapB[x] > 0 ? st.omb[x] / Math.max(1, st.gapB[x]) : tOm;
    sc[x] = wOm * lg2(tOm) + wHeat * lg2(tHt) + wGap * lg2(tGap);
  }
  return sc;
}

function rhyShape(s, st, lastFront, rank) {
  const sum = s.reduce((a, b) => a + b, 0);
  const z = [0, 0, 0];
  s.forEach(x => z[x <= 12 ? 0 : x <= 24 ? 1 : 2]++);
  const odd = s.filter(x => x % 2).length;
  const span = s[s.length - 1] - s[0];
  let pairs = 0;
  for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1] + 1) pairs++;
  let rep = 0;
  if (lastFront) s.forEach(x => { if (lastFront.indexOf(x) > -1) rep++; });

  const center = 0.6 * st.avgSum + 0.4 * 90;
  const sd = Math.max(13, st.sdSum);

  let pen = 0;
  pen += Math.abs(sum - center) / (sd * 1.15);
  pen += z.reduce((a, c) => a + Math.abs(c - 5 / 3), 0) * 0.50;
  pen += Math.pow(Math.abs(odd - 2.5), 1.5) * 0.40;
  pen += Math.abs(span - 27) / 8;
  pen += Math.abs(pairs - 0.55) * 0.40;
  if (lastFront) pen += Math.abs(rep - 0.71) * 0.60;
  const rk = s.reduce((a, x) => a + rank[x], 0) / s.length;
  pen += rk / 24;                       // 节奏排名加成
  return pen;
}

function rhyPickSample(pool, wt, k) {
  const p = pool.slice(), w = pool.map(n => wt[n]);
  const out = [];
  for (let i = 0; i < k; i++) {
    let tot = 0;
    for (let j = 0; j < p.length; j++) tot += w[j];
    let r = Math.random() * tot, idx = p.length - 1;
    for (let j = 0; j < p.length; j++) { r -= w[j]; if (r <= 0) { idx = j; break; } }
    out.push(p[idx]);
    p.splice(idx, 1); w.splice(idx, 1);
  }
  return out.sort((a, b) => a - b);
}

function rhyPick(DATA, win, tone, tries, end) {
  end = (end == null) ? DATA.length : end;
  tries = tries || 2400;
  const st = rhyStats(DATA, win, end);
  const { sc, det, w, omAvg, cAvg } = rhyScores(st, tone);

  const order = [];
  for (let x = 1; x <= RF; x++) order.push(x);
  order.sort((a, b) => sc[b] - sc[a]);
  const rank = new Array(RF + 1).fill(99);
  order.forEach((n, i) => rank[n] = i + 1);

  const lastFront = end > 0 ? DATA[end - 1].front : null;

  // 候选池 = 节奏分前 18 名 + 上期号中分最高的 2 个
  // （上期号遗漏为 0，节奏分天然偏低；但"与上期重 0-1 个"是历史常态，完全排掉会失真。
  //   只给入池资格、不给额外权重，是否被选中交给形态评分里的重号项决定）
  const poolSet = new Set(order.slice(0, 18));
  if (lastFront) {
    lastFront.slice().sort((a, b) => sc[b] - sc[a]).slice(0, 2).forEach(n => poolSet.add(n));
  }
  const pool = Array.from(poolSet).sort((a, b) => sc[b] - sc[a]);
  const floor = sc[pool[pool.length - 1]] - 0.02;
  const lastSet = lastFront ? new Set(lastFront) : null;
  const wt = {};
  pool.forEach(n => {
    const base = Math.pow(Math.max(0.04, sc[n] - floor + 0.30), 1.25);
    wt[n] = lastSet && lastSet.has(n) ? base * 1.45 : base;
  });
  const cands = [];
  for (let t = 0; t < tries; t++) {
    const s = rhyPickSample(pool, wt, 5);
    cands.push({ front: s, pen: rhyShape(s, st, lastFront, rank) });
  }
  cands.sort((a, b) => a.pen - b.pen);
  // 从前若干名里随机取一组：质量几乎一致，但"重新推演"会有变化
  const topN = Math.min(cands.length, 90);
  const best = cands[Math.floor(Math.random() * topN)];

  const bsc = rhyBackScores(st, tone);
  const bOrder = [];
  for (let x = 1; x <= RB; x++) bOrder.push(x);
  bOrder.sort((a, b) => bsc[b] - bsc[a]);
  // 后区从前 5 名里按分数加权抽 2 个：既体现节奏分，又不会永远锁死同样的两个号
  const bTop = bOrder.slice(0, 5);
  const bFloor = bsc[bTop[bTop.length - 1]];
  const bwt = {};
  bTop.forEach(n => bwt[n] = Math.max(0.25, bsc[n] - bFloor + 0.55));
  const back = rhyPickSample(bTop, bwt, 2);

  // 0-100 节奏指数
  const vals = order.map(n => sc[n]);
  const mn = vals[vals.length - 1], mx = vals[0];
  const idx = {};
  for (let x = 1; x <= RF; x++) idx[x] = Math.round((sc[x] - mn) / (mx - mn || 1) * 84 + 16);

  // 后区指数
  const bvals = bOrder.map(n => bsc[n]);
  const bmn = bvals[bvals.length - 1], bmx = bvals[0];
  const bidx = {};
  for (let x = 1; x <= RB; x++) bidx[x] = Math.round((bsc[x] - bmn) / (bmx - bmn || 1) * 76 + 24);

  return {
    front: best.front, back, backAlt: bOrder.slice(2, 5),
    st, sc, det, w, rank, order, pool, poolCore: order.slice(0, 18), idx, bidx, omAvg, cAvg, pen: best.pen, end
  };
}

/* ---------------- 自检：滚动推演 vs 随机 ---------------- */
function rhyOnePrize(front, back, d) {
  let f = 0;
  front.forEach(x => { if (d.front.indexOf(x) > -1) f++; });
  let b = 0;
  back.forEach(x => { if (d.back.indexOf(x) > -1) b++; });
  let p = 0;
  if (f === 5 && b === 2) p = 8000000;
  else if (f === 5 && b === 1) p = 250000;
  else if (f === 5) p = 10000;
  else if (f === 4 && b === 2) p = 3000;
  else if (f === 4 && b === 1) p = 300;
  else if (f === 3 && b === 2) p = 200;
  else if (f === 4) p = 100;
  else if ((f === 3 && b === 1) || (f === 2 && b === 2)) p = 15;
  else if ((f === 3 && b === 0) || (f === 1 && b === 2) || (f === 2 && b === 1) || (f === 0 && b === 2)) p = 5;
  return { hit: f, bh: b, prize: p };
}

function rhySelfTest(DATA, K, win, tone) {
  const N = DATA.length;
  K = Math.min(K, N - win - 1);
  let hitS = 0, hitR = 0, backS = 0, backR = 0, prizeS = 0, prizeR = 0, winS = 0, winR = 0;
  let best = 0;
  const dist = [0, 0, 0, 0, 0, 0];

  for (let i = 0; i < K; i++) {
    const end = N - K + i;
    const d = DATA[end];
    const p = rhyPick(DATA, win, tone, 300, end);
    const a = rhyOnePrize(p.front, p.back, d);
    hitS += a.hit; backS += a.bh; prizeS += a.prize;
    if (a.prize > 0) winS++;
    if (a.hit > best) best = a.hit;
    dist[a.hit]++;

    // 随机对照
    const pool = []; for (let x = 1; x <= RF; x++) pool.push(x);
    const rr = [];
    for (let k = 0; k < 5; k++) {
      const j = Math.floor(Math.random() * pool.length);
      rr.push(pool[j]); pool.splice(j, 1);
    }
    rr.sort((x, y) => x - y);
    const bp = []; for (let x = 1; x <= RB; x++) bp.push(x);
    const rb = [];
    for (let k = 0; k < 2; k++) {
      const j = Math.floor(Math.random() * bp.length);
      rb.push(bp[j]); bp.splice(j, 1);
    }
    rb.sort((x, y) => x - y);
    const b = rhyOnePrize(rr, rb, d);
    hitR += b.hit; backR += b.bh; prizeR += b.prize;
    if (b.prize > 0) winR++;
  }
  return {
    K, cost: K * 2,
    hitS: hitS / K, hitR: hitR / K,
    backS: backS / K * 100, backR: backR / K * 100,
    prizeS, prizeR, winS, winR, best, dist
  };
}

if (typeof module !== 'undefined') module.exports = { rhyStats, rhyScores, rhyPick, rhySelfTest, rhyOnePrize };
