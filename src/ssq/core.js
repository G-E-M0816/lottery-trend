/* ============================================================
   节奏推演核心（纯计算，无 DOM）
   思路：给每个号码算一个"节奏分"，四个分量加权
     遗漏张力  om  / 全盘平均遗漏
     近期热度  cnt / 窗口期望
     短期动能  近5期出现 / 期望
     间隔节奏  om  / 该号自己近几次出现的间隔中位数   ← 真正"节奏"的部分
   tone: 1=跟热  3=均衡  5=压冷
   ============================================================ */

const LN2 = Math.LN2;
const lg2 = v => Math.log(1 + Math.max(0, v)) / LN2;   // v=1 → 1，压缩极端值

function rhyStats(DATA, win, end) {
  end = (end == null) ? DATA.length : end;
  const cnt = new Array(34).fill(0);
  const from = Math.max(0, end - win);
  for (let i = from; i < end; i++) DATA[i].red.forEach(x => cnt[x]++);

  // 当前遗漏
  const om = new Array(34).fill(0), seen = new Array(34).fill(false);
  let remain = 33;
  for (let i = end - 1; i >= 0 && remain > 0; i--) {
    const s = DATA[i].red;
    for (let x = 1; x <= 33; x++) {
      if (seen[x]) continue;
      if (s.indexOf(x) > -1) { seen[x] = true; remain--; } else om[x]++;
    }
  }

  // 近 5 期
  const c5 = new Array(34).fill(0);
  for (let i = Math.max(0, end - 5); i < end; i++) DATA[i].red.forEach(x => c5[x]++);

  // 每个号自己近 6 次出现的间隔（空档期数）中位数
  const gap = new Array(34).fill(0);
  for (let x = 1; x <= 33; x++) {
    const pos = [];
    for (let i = end - 1; i >= 0 && pos.length < 6; i--) {
      if (DATA[i].red.indexOf(x) > -1) pos.push(i);
    }
    if (pos.length >= 4) {
      const ds = [];
      for (let i = 1; i < pos.length; i++) ds.push(pos[i - 1] - pos[i] - 1);
      ds.sort((a, b) => a - b);
      gap[x] = ds[Math.floor(ds.length / 2)];
    }
  }

  // 蓝球
  const cb = new Array(17).fill(0);
  for (let i = from; i < end; i++) cb[DATA[i].blue]++;
  const omb = new Array(17).fill(0), sb = new Array(17).fill(false);
  let rb = 16;
  for (let i = end - 1; i >= 0 && rb > 0; i--) {
    const b = DATA[i].blue;
    if (!sb[b]) { sb[b] = true; rb--; }
    for (let x = 1; x <= 16; x++) if (!sb[x]) omb[x]++;
  }
  const gapB = new Array(17).fill(0);
  for (let x = 1; x <= 16; x++) {
    const pos = [];
    for (let i = end - 1; i >= 0 && pos.length < 6; i--) {
      if (DATA[i].blue === x) pos.push(i);
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
    const s = DATA[i].red.reduce((a, b) => a + b, 0);
    sum += s; sum2 += s * s; n++;
  }
  const avgSum = n ? sum / n : 102;
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
  for (let x = 1; x <= 33; x++) { omSum += st.om[x]; cSum += st.cnt[x]; }
  const omAvg = (omSum / 33) || 4.5;
  const cAvg = (cSum / 33) || (st.win * 6 / 33 || 1);

  // 各分量先算原始值
  const raw = {}, det = {};
  for (let x = 1; x <= 33; x++) {
    const tOm = st.om[x] / omAvg;
    const tHt = st.cnt[x] / cAvg;
    const tMo = st.c5[x] / (5 * 6 / 33);
    // 间隔项：遗漏相对"自己的惯常间隔"越到位分越高，但到点后饱和，
    // 不做"憋得越久越该出"的线性奖励（否则整组会极端偏冷）
    const g = st.gap[x] > 0 ? st.om[x] / Math.max(1, st.gap[x]) : 1;
    const tGap = 1 - Math.exp(-Math.pow(Math.max(0, g), 1.3));
    raw[x] = { om: lg2(tOm), ht: lg2(tHt), mo: lg2(tMo), gap: tGap };
    det[x] = { tOm, tHt, tMo, tGap };
  }
  // 标准化：四个分量的量纲差很多（遗漏能到 6 倍、热度只到 2 倍），
  // 不做 z-score 的话"权重"形同虚设，冷号会无脑占优
  const keys = ['om', 'ht', 'mo', 'gap'];
  const zs = {};
  keys.forEach(k => {
    const v = [];
    for (let x = 1; x <= 33; x++) v.push(raw[x][k]);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length) || 1;
    zs[k] = new Array(34).fill(0);
    for (let x = 1; x <= 33; x++) zs[k][x] = (raw[x][k] - m) / sd;
  });
  const sc = new Array(34).fill(0);
  for (let x = 1; x <= 33; x++) {
    sc[x] = wOm * zs.om[x] + wHeat * zs.ht[x] + wMom * zs.mo[x] + wGap * zs.gap[x];
  }
  return { sc, det, w: { wOm, wHeat, wMom, wGap }, omAvg, cAvg };
}

function rhyBlueScores(st, tone) {
  const t = (Math.min(5, Math.max(1, tone)) - 1) / 4;
  const wHeat = 0.42 - 0.30 * t, wGap = 0.16 + 0.24 * t, wOm = 0.10 + 0.26 * t;
  let omSum = 0, cSum = 0;
  for (let x = 1; x <= 16; x++) { omSum += st.omb[x]; cSum += st.cb[x]; }
  const omAvg = (omSum / 16) || 15;
  const cAvg = (cSum / 16) || (st.win / 16 || 1);
  const sc = new Array(17).fill(0);
  for (let x = 1; x <= 16; x++) {
    const tOm = st.omb[x] / omAvg;
    const tHt = st.cb[x] / cAvg;
    const tGap = st.gapB[x] > 0 ? st.omb[x] / Math.max(1, st.gapB[x]) : tOm;
    sc[x] = wOm * lg2(tOm) + wHeat * lg2(tHt) + wGap * lg2(tGap);
  }
  return sc;
}

function rhyShape(s, st, lastRed, rank) {
  const sum = s.reduce((a, b) => a + b, 0);
  const z = [0, 0, 0];
  s.forEach(x => z[x <= 11 ? 0 : x <= 22 ? 1 : 2]++);
  const odd = s.filter(x => x % 2).length;
  const span = s[5] - s[0];
  let pairs = 0;
  for (let i = 1; i < 6; i++) if (s[i] === s[i - 1] + 1) pairs++;
  let rep = 0;
  if (lastRed) s.forEach(x => { if (lastRed.indexOf(x) > -1) rep++; });

  const center = 0.6 * st.avgSum + 0.4 * 102;
  const sd = Math.max(13, st.sdSum);

  let pen = 0;
  pen += Math.abs(sum - center) / (sd * 1.15);
  pen += z.reduce((a, c) => a + Math.abs(c - 2), 0) * 0.50;
  pen += Math.pow(Math.abs(odd - 3), 1.5) * 0.62;
  pen += Math.abs(span - 25) / 8;
  pen += Math.abs(pairs - 1.0) * 0.40;
  if (lastRed) pen += Math.abs(rep - 1.1) * 0.70;
  const rk = s.reduce((a, x) => a + rank[x], 0) / 6;
  pen += rk / 22;                       // 节奏排名加成
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
  for (let x = 1; x <= 33; x++) order.push(x);
  order.sort((a, b) => sc[b] - sc[a]);
  const rank = new Array(34).fill(99);
  order.forEach((n, i) => rank[n] = i + 1);

  const lastRed = end > 0 ? DATA[end - 1].red : null;

  // 候选池 = 节奏分前 14 名 + 上期号中分最高的 2 个
  // （上期号遗漏为 0，节奏分天然偏低；但"与上期重 1 个"是历史常态，完全排掉会失真。
  //   只给入池资格、不给额外权重，是否被选中交给形态评分里的重号项决定）
  const poolSet = new Set(order.slice(0, 14));
  if (lastRed) {
    lastRed.slice().sort((a, b) => sc[b] - sc[a]).slice(0, 2).forEach(n => poolSet.add(n));
  }
  const pool = Array.from(poolSet).sort((a, b) => sc[b] - sc[a]);
  const floor = sc[pool[pool.length - 1]] - 0.02;
  const lastSet = lastRed ? new Set(lastRed) : null;
  const wt = {};
  pool.forEach(n => {
    const base = Math.pow(Math.max(0.04, sc[n] - floor + 0.30), 1.5);
    wt[n] = lastSet && lastSet.has(n) ? base * 1.45 : base;
  });
  const cands = [];
  for (let t = 0; t < tries; t++) {
    const s = rhyPickSample(pool, wt, 6);
    cands.push({ red: s, pen: rhyShape(s, st, lastRed, rank) });
  }
  cands.sort((a, b) => a.pen - b.pen);
  // 从前 40 名里随机取一组：质量几乎一致，但"重新推演"会有变化
  const topN = Math.min(cands.length, 90);
  const best = cands[Math.floor(Math.random() * topN)];

  const bsc = rhyBlueScores(st, tone);
  const bOrder = [];
  for (let x = 1; x <= 16; x++) bOrder.push(x);
  bOrder.sort((a, b) => bsc[b] - bsc[a]);

  // 0-100 节奏指数
  const vals = order.map(n => sc[n]);
  const mn = vals[vals.length - 1], mx = vals[0];
  const idx = {};
  for (let x = 1; x <= 33; x++) idx[x] = Math.round((sc[x] - mn) / (mx - mn || 1) * 84 + 16);

  return {
    red: best.red, blue: bOrder[0], blueAlt: bOrder.slice(1, 4),
    st, sc, det, w, rank, order, pool, poolCore: order.slice(0, 14), idx, omAvg, cAvg, pen: best.pen, end
  };
}

/* ---------------- 自检：滚动推演 vs 随机 ---------------- */
function rhyOnePrize(red, blue, d) {
  let hit = 0;
  red.forEach(x => { if (d.red.indexOf(x) > -1) hit++; });
  const bh = blue === d.blue;
  const T = [[0, 0], [6, 1], [6, 0], [5, 1], [5, 0], [4, 1], [4, 0], [3, 1], [2, 1], [1, 1], [0, 1]];
  // 简化：按命中数定奖级
  let p = 0;
  if (hit === 6 && bh) p = 5000000;
  else if (hit === 6) p = 200000;
  else if (hit === 5 && bh) p = 3000;
  else if (hit === 5 || (hit === 4 && bh)) p = 200;
  else if (hit === 4 || (hit === 3 && bh)) p = 10;
  else if (bh) p = 5;
  return { hit, bh, prize: p };
}

function rhySelfTest(DATA, K, win, tone, onStep) {
  const N = DATA.length;
  K = Math.min(K, N - win - 1);
  let hitS = 0, hitR = 0, blueS = 0, blueR = 0, prizeS = 0, prizeR = 0, winS = 0, winR = 0;
  let best = 0;
  const dist = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < K; i++) {
    const end = N - K + i;
    const d = DATA[end];
    const p = rhyPick(DATA, win, tone, 300, end);
    const a = rhyOnePrize(p.red, p.blue, d);
    hitS += a.hit; blueS += a.bh ? 1 : 0; prizeS += a.prize;
    if (a.prize > 0) winS++;
    if (a.hit > best) best = a.hit;
    dist[a.hit]++;

    // 随机对照
    const pool = []; for (let x = 1; x <= 33; x++) pool.push(x);
    const rr = [];
    for (let k = 0; k < 6; k++) {
      const j = Math.floor(Math.random() * pool.length);
      rr.push(pool[j]); pool.splice(j, 1);
    }
    rr.sort((x, y) => x - y);
    const rb = 1 + Math.floor(Math.random() * 16);
    const b = rhyOnePrize(rr, rb, d);
    hitR += b.hit; blueR += b.bh ? 1 : 0; prizeR += b.prize;
    if (b.prize > 0) winR++;
  }
  return {
    K, cost: K * 2,
    hitS: hitS / K, hitR: hitR / K,
    blueS: blueS / K * 100, blueR: blueR / K * 100,
    prizeS, prizeR, winS, winR, best, dist
  };
}

if (typeof module !== 'undefined') module.exports = { rhyStats, rhyScores, rhyPick, rhySelfTest, rhyOnePrize };
