/* ============================================================
   节奏推演 · 界面层
   ============================================================ */
let RHY = { win: 30, tone: 3, res: null, test: null };

function rhyNextCode() {
  const c = DATA[DATA.length - 1].code;
  return c + 1;
}

function rhyRender() {
  // 重算时避开与上次完全相同的组合，否则连点"重新推演"看着像没反应
  let r = rhyPick(DATA, RHY.win, RHY.tone, 2400);
  for (let i = 0; i < 6 && RHY.res && r.red.join() === RHY.res.red.join() && r.blue === RHY.res.blue; i++) {
    r = rhyPick(DATA, RHY.win, RHY.tone, 2400);
  }
  RHY.res = r;
  const st = r.st;
  const lastRed = DATA[DATA.length - 1].red;

  const sum = r.red.reduce((a, b) => a + b, 0);
  const odd = r.red.filter(x => x % 2).length;
  const z = [0, 0, 0];
  r.red.forEach(x => z[x <= 11 ? 0 : x <= 22 ? 1 : 2]++);
  let rep = 0;
  lastRed.forEach(x => { if (r.red.indexOf(x) > -1) rep++; });

  /* ---------- 号码区 ---------- */
  let h = '<div class="rhy-hero">';
  h += '<div class="rhy-cap"><span class="dot"></span>第 <b>' + rhyNextCode() + '</b> 期 · 推演一组</div>';
  h += '<div class="rhy-balls">';
  r.red.forEach((x, i) => {
    h += '<div class="rb" style="animation-delay:' + (i * 55) + 'ms">' +
      '<span class="ball lg">' + pad(x) + '</span>' +
      '<span class="m">遗漏 ' + st.om[x] + '</span>' +
      '<span class="m2">节奏 ' + r.idx[x] + '</span></div>';
  });
  h += '<div class="rb sep" style="animation-delay:380ms">' +
    '<span class="ball lg blue">' + pad(r.blue) + '</span>' +
    '<span class="m">遗漏 ' + st.omb[r.blue] + '</span>' +
    '<span class="m2">蓝球</span></div>';
  h += '</div>';
  h += '<div class="rhy-meta">' +
    '<span>和值 <b>' + sum + '</b></span><i></i>' +
    '<span>奇偶 <b>' + odd + ':' + (6 - odd) + '</b></span><i></i>' +
    '<span>三区 <b>' + z.join(':') + '</b></span><i></i>' +
    '<span>重号 <b>' + rep + '</b></span>' +
    '</div>';
  h += '</div>';
  h += '<div class="rhy-note">这组号不是"必出号"。它只是把最近 ' + RHY.win +
    ' 期里<b>遗漏超标、间隔到点、热度靠前</b>的号先圈进 14 个候选，再从中挑出一组<b>形态最贴近近期开奖</b>的组合（和值、三区、奇偶、与上期重号都在打分里）。' +
    '号码会挑得更"顺眼"，中奖概率一分没多——下面的自检就是证明。</div>';
  $('#rhyMain').innerHTML = h;

  /* ---------- 依据 ---------- */
  let omS = 0, cntS = 0, due = 0;
  r.red.forEach(x => {
    omS += st.om[x]; cntS += st.cnt[x];
    if (st.gap[x] > 0 && st.om[x] >= st.gap[x] * 1.2) due++;
  });
  const avgOm = omS / 6, expCnt = 6 * RHY.win * 6 / 33;
  const omRatio = avgOm / r.omAvg;
  const omTxt = omRatio > 1.3 ? '<em>偏冷 ' + omRatio.toFixed(1) + ' 倍</em>'
    : omRatio < 0.8 ? '<em>偏热 ' + (1 / omRatio).toFixed(1) + ' 倍</em>' : '与全盘持平';
  const toneTxt = RHY.tone <= 1.6 ? '跟热' : RHY.tone >= 4.4 ? '抓冷' : '稳健';

  let b = '';
  b += '<div class="rk-row"><span class="rk-k">遗漏张力</span><span class="rk-v">本组平均遗漏 <em>' +
    avgOm.toFixed(1) + '</em> 期，全盘平均 ' + r.omAvg.toFixed(1) + ' 期 → ' + omTxt + '</span></div>';
  b += '<div class="rk-row"><span class="rk-k">近期热度</span><span class="rk-v">近 ' + RHY.win +
    ' 期合计开出 <em>' + cntS + '</em> 次，随机期望 ' + expCnt.toFixed(1) + ' 次</span></div>';
  b += '<div class="rk-row"><span class="rk-k">间隔节奏</span><span class="rk-v"><em>' + due +
    ' / 6</em> 个号已超过自己的惯常出现间隔（每个号的间隔取自它近 6 次开出的中位数）</span></div>';
  b += '<div class="rk-row"><span class="rk-k">形态匹配</span><span class="rk-v">和值 <em>' + sum + '</em>，近 ' + RHY.win +
    ' 期均值 ' + st.avgSum.toFixed(0) + '；三区 ' + z.join(':') + '，奇偶 ' + odd + ':' + (6 - odd) + '，与上期重 ' + rep + ' 个</span></div>';
  b += '<div class="rk-row"><span class="rk-k">权重分配</span><span class="rk-v">' + toneTxt + '：遗漏 ' +
    Math.round(r.w.wOm * 100) + '% · 热度 ' + Math.round(r.w.wHeat * 100) + '% · 动能 ' +
    Math.round(r.w.wMom * 100) + '% · 间隔 ' + Math.round(r.w.wGap * 100) + '%</span></div>';
  $('#rhyBasis').innerHTML = b;
  $('#rhySub').textContent = '近 ' + RHY.win + ' 期 · ' + toneTxt;

  /* ---------- 33 宫格 ---------- */
  let g = '';
  const selSet = new Set(r.red);
  const poolSet = new Set(r.poolCore);
  const lastSet = new Set(lastRed);
  for (let x = 1; x <= 33; x++) {
    // 只为"上期重号"拉进池的号，不显示低分，改标"上期"
    const byRep = lastSet.has(x) && !poolSet.has(x);
    let cls = 'nb';
    if (selSet.has(x)) cls += ' sel';
    else if (poolSet.has(x)) cls += ' pool';
    else if (byRep) cls += ' lastrep';
    const tag = byRep ? '上期' : r.idx[x];
    g += '<div class="' + cls + '" title="节奏指数 ' + r.idx[x] + ' · 遗漏 ' + st.om[x] +
      ' 期 · 近' + RHY.win + '期出 ' + st.cnt[x] + ' 次">' +
      '<b>' + pad(x) + '</b><span>' + tag + '</span></div>';
  }
  $('#rhyGrid').innerHTML = g;

  /* ---------- 蓝球候选 ---------- */
  let ba = '<div class="alt-row"><span class="mut">主推</span><span class="bub b">' + pad(r.blue) + '</span>' +
    '<span class="mut" style="margin-left:8px">备选</span>' +
    r.blueAlt.map(x => '<span class="bub g">' + pad(x) + '</span>').join('') + '</div>';
  $('#rhyBlueAlt').innerHTML = ba;
}

/* ---------------- 自检 ---------------- */
function rhyRunTest(K) {
  const box = $('#rhyTest');
  const btn = $('#btnRhyTest');
  btn.disabled = true;
  box.innerHTML = '<div class="empty" style="padding:18px 8px">正在滚动推演 ' + K + ' 期…</div>';

  setTimeout(() => {
    const t0 = Date.now();
    const r = rhySelfTest(DATA, K, RHY.win, RHY.tone);
    RHY.test = r;
    const diffHit = r.hitS - r.hitR;
    const diffBlue = r.blueS - r.blueR;
    const retS = r.prizeS / r.cost * 100, retR = r.prizeR / r.cost * 100;
    const verdict = Math.abs(diffHit) < 0.09 && Math.abs(diffBlue) < 2.2
      ? '和随机基本没差别'
      : (diffHit > 0 ? '这一轮略好于随机' : '这一轮不如随机');
    const blueCmp = Math.abs(diffBlue) < 0.8 ? '基本持平'
      : (diffBlue > 0 ? '高 ' + diffBlue.toFixed(1) + ' 个百分点' : '低 ' + Math.abs(diffBlue).toFixed(1) + ' 个百分点');

    let h = '<div class="bt-res">';
    h += '<div class="bt-card"><div class="t">平均命中红球</div>' +
      '<div class="v" style="color:#ff7a6e">' + r.hitS.toFixed(2) + ' <span style="font-size:10px;color:#6c7482">个</span></div>' +
      '<div class="s">随机 ' + r.hitR.toFixed(2) + ' 个 · 理论 1.09 个</div></div>';
    h += '<div class="bt-card"><div class="t">蓝球命中率</div>' +
      '<div class="v" style="color:#8ab8ff">' + r.blueS.toFixed(1) + '%</div>' +
      '<div class="s">随机 ' + r.blueR.toFixed(1) + '% · 理论 6.25%</div></div>';
    h += '<div class="bt-card"><div class="t">中奖次数</div>' +
      '<div class="v">' + r.winS + ' <span style="font-size:10px;color:#6c7482">次</span></div>' +
      '<div class="s">随机对照 ' + r.winR + ' 次</div></div>';
    h += '<div class="bt-card"><div class="t">投入 / 回收</div>' +
      '<div class="v" style="font-size:14px">' + r.cost + ' → ' + r.prizeS + ' 元</div>' +
      '<div class="s">回报 ' + retS.toFixed(1) + '% · 随机 ' + retR.toFixed(1) + '%</div></div>';
    h += '</div>';

    h += '<div class="bt-verdict"><b>' + K + ' 期滚动推演，' + verdict + '。</b>' +
      '策略平均每期命中 ' + r.hitS.toFixed(2) + ' 个红球、随机 ' + r.hitR.toFixed(2) +
      ' 个，差距 ' + (diffHit >= 0 ? '+' : '') + diffHit.toFixed(2) +
      ' 个；蓝球命中率 ' + r.blueS.toFixed(1) + '% 对 ' + r.blueR.toFixed(1) + '%，' + blueCmp + '。' +
      '这点差距在一两百期里全靠运气，把期数换成别的值，方向就会翻。' +
      '上面那组"推演号码"真正的价值是<b>挑得有理有据、看着舒服</b>，不会提高中奖率。</div>';

    const mx = Math.max.apply(null, r.dist) || 1;
    h += '<div class="dist-cap">每期命中几个红球 · 各多少期</div>';
    h += '<div class="dist-row">' +
      r.dist.map((v, i) => '<span class="dist-i' + (v ? '' : ' dim') + '">' +
        '<b>' + i + '</b><em>' + v + '</em>' +
        '<i style="width:' + Math.round(v / mx * 100) + '%"></i></span>').join('') +
      '</div>';

    h += '<div class="mut" style="margin-top:8px">耗时 ' + (Date.now() - t0) + ' ms · 每期只使用"当期之前"的数据</div>';
    box.innerHTML = h;
    btn.disabled = false;
  }, 40);
}

/* ---------------- 复制 ---------------- */
function copyRhy() {
  const r = RHY.res;
  if (!r) { toast('先推演一组'); return; }
  const t = '双色球 第 ' + rhyNextCode() + ' 期 · 节奏推演（近 ' + RHY.win + ' 期）\n' +
    '红球  ' + r.red.map(pad).join(' ') + '\n' +
    '蓝球  ' + pad(r.blue) + '\n' +
    '蓝球备选  ' + r.blueAlt.map(pad).join(' ');
  const fb = txt => {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    toast(ok ? '已复制，可直接粘贴' : '复制失败，请手动选择');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => toast('已复制，可直接粘贴')).catch(() => fb(t));
  } else fb(t);
}

/* ---------------- 事件 ---------------- */
$$('#rhyWinSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#rhyWinSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  RHY.win = +b.dataset.w;
  rhyRender();
}));

$$('#rhyToneSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#rhyToneSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  RHY.tone = +b.dataset.t;
  rhyRender();
}));

$('#btnRhy').addEventListener('click', () => {
  rhyRender();
  toast('重新推演了一组');
});
$('#btnRhyCopy').addEventListener('click', copyRhy);

$$('#rhyTestSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#rhyTestSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
}));
$('#btnRhyTest').addEventListener('click', () => {
  const on = $('#rhyTestSeg button.on');
  rhyRunTest(+(on ? on.dataset.k : 500));
});

rhyRender();

// 首次切到本页时自动跑一次自检，让结论先摆出来
let rhySeen = false;
$$('#tabs button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.tab === 'rhy' && !rhySeen) {
    rhySeen = true;
    setTimeout(() => rhyRunTest(500), 260);
  }
}));
