# -*- coding: utf-8 -*-
"""把双色球 / 大乐透两个单页应用合并成一条链接的双页签版本"""
import io, re, os

BASE = os.path.dirname(os.path.abspath(__file__))
# 源码目录：GitHub 仓库里是 ./src，沙箱工作目录里是上一级
SRC = os.path.join(BASE, 'src') if os.path.isdir(os.path.join(BASE, 'src')) else os.path.dirname(BASE)
SSQ = os.path.join(SRC, 'ssq')
DLT = os.path.join(SRC, 'dlt')
OUT = os.environ.get('OUT_DIR') or BASE

def read(p):
    return io.open(p, encoding='utf-8').read()

def extract(s):
    """返回 (css, body_html)"""
    css = s[s.index('<style>') + 7: s.index('</style>')]
    b = s[s.index('<body'):]
    b = b[b.index('>') + 1:]                  # 去掉 <body ...>
    body = b[: b.index('<script')].rstrip()   # 第一个 script 之前的 HTML
    return css, body

def make_code(dirname, data_json):
    parts = [read(os.path.join(dirname, f)) for f in
             ['app1.js', 'app2.js', 'core.js', 'app3.js']]
    code = 'const RAW=' + data_json + ';\n' + '\n'.join(parts)
    # 异步任务加代际守卫：切走之后旧的 setTimeout 回调直接丢弃
    guard = (
        "var __NST = window['setTimeout'].bind(window);\n"
        "var __G = (window.__GEN = (window.__GEN || 0) + 1);\n"
        "var __st = function (fn, ms) { var g = __G; return __NST(function () {"
        " if (g !== window.__GEN) return;"
        " try { fn(); } catch (e) { console.warn('[stale]', e); } }, ms); };\n"
    )
    code = guard + code
    code = re.sub(r'(?<![.\w])setTimeout\(', '__st(', code)
    return code

css_s, body_s = extract(read(os.path.join(SSQ, 'template.html')))
css_d, body_d = extract(read(os.path.join(DLT, 'template.html')))

# 统一由 CSS 变量控制列数：去掉 ssq 里 #blueGrid 的 inline 覆盖
body_s = re.sub(r'(id="blueGrid")\s+style="grid-template-columns:[^"]*"', r'\1', body_s)

# ---------- CSS ----------
css = css_s

def sub1(old, new, s):
    assert old in s, 'CSS 片段未找到: ' + old[:60]
    return s.replace(old, new, 1)

css = sub1('position:sticky;top:0;z-index:20;backdrop-filter:blur(14px);',
           'position:sticky;top:var(--bar,0px);z-index:20;backdrop-filter:blur(14px);', css)
css = sub1('.g33{display:grid;grid-template-columns:repeat(11,1fr);gap:5px}',
           '.g33{display:grid;grid-template-columns:repeat(var(--gc,11),1fr);gap:5px}', css)
css = sub1('.g33{gap:4px}\n', '.g33{gap:4px;grid-template-columns:repeat(var(--gcm,11),1fr)}\n', css)

extra = """
  /* ================= 双玩法外壳 ================= */
  :root{--bar:50px}
  body[data-lot="ssq"]{--gc:11;--bg:8;--gcm:11;--bgm:8}
  body[data-lot="dlt"]{--gc:12;--bg:12;--gcm:7;--bgm:6}

  .lotbar{
    position:sticky;top:0;z-index:60;height:var(--bar);
    display:flex;align-items:center;justify-content:center;
    padding:0 14px;
    background:linear-gradient(180deg,rgba(9,10,14,.94) 0%,rgba(9,10,14,.66) 100%);
    backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
    border-bottom:1px solid rgba(255,255,255,.055);
  }
  .lotbar .seg{
    display:flex;gap:3px;padding:3px;border-radius:11px;
    background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);
  }
  .lotbar .seg button{
    border:0;background:transparent;color:#8b93a1;font-size:12.5px;font-weight:600;
    padding:6px 20px;border-radius:8px;cursor:pointer;
    transition:color .16s,background .16s;white-space:nowrap;letter-spacing:.2px;
  }
  .lotbar .seg button:hover{color:#d5dae3}
  .lotbar .seg button.on{
    background:linear-gradient(180deg,rgba(255,255,255,.135),rgba(255,255,255,.055));
    box-shadow:0 2px 10px -5px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.07);
  }
  .lotbar .seg button.on[data-lot="ssq"]{color:#ff6f63}
  .lotbar .seg button.on[data-lot="dlt"]{color:#f5c85a}
  #mount{display:block}

  /* 大乐透独有的样式差异 */
  #blueGrid{grid-template-columns:repeat(var(--bg,8),1fr)}
  .rb .m i{font-style:normal;margin-right:2px}
  .rhy-hint{display:none}
  body[data-lot="dlt"] .dist-row{grid-template-columns:repeat(6,1fr)}

  @media (max-width:640px){
    :root{--bar:46px}
    .lotbar .seg button{font-size:12px;padding:6px 16px}
    #blueGrid{grid-template-columns:repeat(var(--bgm,8),1fr)}
    body[data-lot="dlt"] .nb{padding:5px 0 4px}
    body[data-lot="dlt"] .nb span{font-size:8px}
    body[data-lot="dlt"] .rb .m{font-size:9px}
    body[data-lot="dlt"] .rb .m i{display:none}
    .rhy-hint{display:block;text-align:center;font-size:10px;color:#565e6b;margin-top:10px;line-height:1.6}
  }
"""

style = '<style>' + css.rstrip() + '\n' + extra + '</style>'

# ---------- HTML ----------
HEAD = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#0a0b0f" />
<meta name="description" content="双色球 / 大乐透走势分析工具：完整历史开奖数据、走势图、遗漏与冷热统计、形态分析、节奏推演与选号方案。彩票每期独立随机，任何方法都无法预测，请理性购彩。"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%2312151b'/%3E%3Ccircle cx='36' cy='50' r='24' fill='%23e8382f'/%3E%3Ccircle cx='70' cy='50' r='24' fill='%23f2c14e'/%3E%3C/svg%3E" />
<title>双色球 / 大乐透 · 走势分析</title>
{TITLE}
</head>
<body data-lot="ssq">
<div class="lotbar">
  <div class="seg" role="tablist">
    <button type="button" data-lot="ssq" class="on" role="tab">双色球</button>
    <button type="button" data-lot="dlt" role="tab">大乐透</button>
  </div>
</div>
<div id="mount"></div>

<template id="tpl-ssq">
{BODY_S}
</template>

<template id="tpl-dlt">
{BODY_D}
</template>

<script type="text/plain" id="code-ssq">
{CODE_S}
</script>

<script type="text/plain" id="code-dlt">
{CODE_D}
</script>
"""

TAIL = """
<script>
(function () {
  var TPL = {}, CODE = {}, cur = null;
  var mem = { ssq: 'trend', dlt: 'trend' };

  ['ssq', 'dlt'].forEach(function (k) {
    TPL[k] = document.getElementById('tpl-' + k).innerHTML;
    CODE[k] = document.getElementById('code-' + k).textContent;
  });

  var mount = document.getElementById('mount');
  var btns = Array.prototype.slice.call(document.querySelectorAll('.lotbar .seg button'));
  var LABEL = { ssq: '双色球', dlt: '大乐透' };

  function go(k) {
    if (cur === k) return;
    if (cur) {
      var onb = document.querySelector('#tabs button.on');
      if (onb && onb.dataset.tab) mem[cur] = onb.dataset.tab;
    }
    cur = k;
    window.__GEN = (window.__GEN || 0) + 1;   // 让上一玩法的异步回调失效
    document.body.setAttribute('data-lot', k);
    document.title = LABEL[k] + ' · 走势分析';
    btns.forEach(function (b) { b.classList.toggle('on', b.dataset.lot === k); });
    try { history.replaceState(null, '', '#' + k); } catch (e) {}

    mount.innerHTML = TPL[k];
    window.scrollTo(0, 0);

    try { (new Function(CODE[k]))(); }
    catch (e) { console.error('[' + k + '] init failed', e); }

    var t = mem[k];
    if (t && t !== 'trend') {
      var tb = document.querySelector('#tabs button[data-tab="' + t + '"]');
      if (tb) tb.click();
    }
  }

  btns.forEach(function (b) {
    b.addEventListener('click', function () { go(b.dataset.lot); });
  });

  // 地址栏里手动改 #dlt / #ssq 也能切（首次打开由下面的 first 逻辑处理）
  window.addEventListener('hashchange', function () {
    var k = (location.hash || '').replace('#', '');
    if (LABEL[k]) go(k);
  });

  var first = (location.hash || '').replace('#', '');
  if (!LABEL[first]) first = 'ssq';
  go(first);
})();
</script>
</body>
</html>
"""

out = (HEAD
       .replace('{TITLE}', style)
       .replace('{BODY_S}', body_s)
       .replace('{BODY_D}', body_d)
       .replace('{CODE_S}', make_code(SSQ, read(os.path.join(BASE, 'data', 'ssq.json'))))
       .replace('{CODE_D}', make_code(DLT, read(os.path.join(BASE, 'data', 'dlt.json'))))
       + TAIL)

os.makedirs(OUT, exist_ok=True)
dst = os.path.join(OUT, 'index.html')
io.open(dst, 'w', encoding='utf-8').write(out)
print('built', dst, len(out.encode()) // 1024, 'KB')
