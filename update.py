# -*- coding: utf-8 -*-
"""增量抓取最新开奖数据，合并进本地库。

数据源顺序：500.com → 官网接口
  500.com 排在前面是有原因的：它对境内外 IP 都可达，GitHub Actions 的
  海外 runner 也能抓（很多长期运行的开奖数据仓库都只用这一个源）。
  福彩官网会对境外机房 IP 返回 403，体彩接口境外也可能超时，所以官方
  接口放在第二位——国内跑的时候 500.com 同样很快，不必抢这一个先后。

退出码：0=有新数据  2=无新数据  1=抓取/校验失败
"""
import io, os, re, sys, json, time
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')

CFG = {
    'ssq': {'name': '双色球', 'nred': 6, 'nblue': 1},
    'dlt': {'name': '大乐透', 'nred': 5, 'nblue': 2},
}

# 代理：优先 LOTTERY_PROXY，其次标准的 HTTPS_PROXY / HTTP_PROXY
_PROXY = (os.environ.get('LOTTERY_PROXY')
          or os.environ.get('HTTPS_PROXY')
          or os.environ.get('HTTP_PROXY') or '').strip()

if _PROXY:
    OPENER = urllib.request.build_opener(
        urllib.request.ProxyHandler({'http': _PROXY, 'https': _PROXY}))
else:
    OPENER = urllib.request.build_opener()


def http_bytes(url, referer):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Referer': referer,
        'Accept-Language': 'zh-CN,zh;q=0.9',
    })
    # 30 秒。海外 runner 抓 500.com 实测要 21s（双色球 1.6s），留足余量
    timeout = int(os.environ.get('LOTTERY_TIMEOUT') or 30)
    with OPENER.open(req, timeout=timeout) as r:
        return r.read()


def http_json(url, referer):
    return json.loads(http_bytes(url, referer).decode('utf-8'))


def to_int(s, default=0):
    s = str(s or '').replace(',', '').strip()
    try:
        return int(round(float(s)))
    except ValueError:
        return default


# ---------------- 双色球 ----------------
def fetch_ssq_official():
    url = ('https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
           '?name=ssq&issueCount=&issueStart=&issueEnd=&dayStart=&dayEnd='
           '&pageNo=1&pageSize=100&week=&systemType=PC')
    d = http_json(url, 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/')
    out = []
    for r in d.get('result') or []:
        code = to_int(str(r.get('code', ''))[-5:])
        date = re.sub(r'\D', '', str(r.get('date', '')))[:8]
        reds = [to_int(x) for x in str(r.get('red', '')).split(',') if x.strip()]
        blue = to_int(r.get('blue'))
        if not code or len(date) != 8 or len(reds) != 6 or not blue:
            continue
        p1 = 0
        for g in r.get('prizegrades') or []:
            if g.get('type') == 1:
                p1 = to_int(g.get('typemoney'))
                break
        out.append([code, int(date), reds, blue, to_int(r.get('poolmoney')), p1])
    return out


def fetch_ssq_500():
    url = 'https://datachart.500.com/ssq/history/newinc/history.php?limit=80&sort=0'
    html = http_bytes(url, 'https://datachart.500.com/ssq/history/history.shtml')
    txt = html.decode('gb18030', 'ignore')
    out = []
    for row in re.findall(r'<tr class="t_tr1">(.*?)</tr>', txt, re.S):
        row = re.sub(r'<!--.*?-->', '', row, flags=re.S)
        cells = re.findall(r'<td([^>]*)>(.*?)</td>', row, re.S)
        reds, blues, plain = [], [], []
        for attr, inner in cells:
            m = re.search(r'class="([^"]*)"', attr)
            c = m.group(1) if m else ''
            t = re.sub(r'<[^>]+>', '', inner).replace('&nbsp;', '').strip()
            if 't_cfont2' in c:
                reds.append(to_int(t))
            elif 't_cfont4' in c:
                if t:
                    blues.append(to_int(t))
            else:
                plain.append(t)
        if len(reds) != 6 or not blues or len(plain) < 8:
            continue
        date = re.sub(r'\D', '', plain[-1])
        if len(date) != 8:
            continue
        out.append([to_int(plain[0]), int(date), reds, blues[0],
                    to_int(plain[1]), to_int(plain[3])])
    return out


# ---------------- 大乐透 ----------------
def fetch_dlt_official():
    url = ('https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry'
           '?gameNo=85&provinceId=0&pageSize=100&isVerify=1&pageNo=1')
    d = http_json(url, 'https://static.sporttery.cn/')
    out = []
    for r in (d.get('value') or {}).get('list') or []:
        code = to_int(r.get('lotteryDrawNum'))
        date = re.sub(r'\D', '', str(r.get('lotteryDrawTime', '')))[:8]
        nums = [to_int(x) for x in str(r.get('lotteryDrawResult', '')).split() if x.strip()]
        if not code or len(date) != 8 or len(nums) < 7:
            continue
        p1 = 0
        for g in r.get('prizeLevelList') or []:
            if str(g.get('prizeLevel', '')).strip() == '一等奖':
                p1 = to_int(g.get('stakeAmount'))
                break
        out.append([code, int(date), nums[:5], nums[5:7],
                    to_int(r.get('poolBalanceAfterdraw')), p1])
    return out


def fetch_dlt_500():
    url = 'https://datachart.500.com/dlt/history/newinc/history.php?limit=80&sort=0'
    html = http_bytes(url, 'https://datachart.500.com/dlt/history/history.shtml')
    txt = html.decode('utf-8', 'ignore')
    out = []
    for row in re.findall(r'<tr class="t_tr1">(.*?)</tr>', txt, re.S):
        row = re.sub(r'<!--.*?-->', '', row, flags=re.S)
        cells = re.findall(r'<td([^>]*)>(.*?)</td>', row, re.S)
        reds, blues, plain = [], [], []
        for attr, inner in cells:
            m = re.search(r'class="([^"]*)"', attr)
            c = m.group(1) if m else ''
            t = re.sub(r'<[^>]+>', '', inner).replace('&nbsp;', '').strip()
            if 'cfont2' in c:
                reds.append(to_int(t))
            elif 'cfont4' in c:
                if t:
                    blues.append(to_int(t))
            else:
                plain.append(t)
        if len(reds) != 5 or len(blues) != 2 or len(plain) < 8:
            continue
        date = re.sub(r'\D', '', plain[-1])
        if len(date) != 8:
            continue
        out.append([to_int(plain[0]), int(date), reds, blues,
                    to_int(plain[1]), to_int(plain[3])])
    return out


# 顺序有意义：先试境内外都能通的 500.com，再试官网接口
SOURCES = {
    'ssq': [('500.com', fetch_ssq_500), ('福彩官网', fetch_ssq_official)],
    'dlt': [('500.com', fetch_dlt_500), ('体彩官网', fetch_dlt_official)],
}


def valid(row, cfg):
    if not (row[0] > 0 and len(str(row[1])) == 8):
        return False
    if len(row[2]) != cfg['nred']:
        return False
    blues = row[3] if isinstance(row[3], list) else [row[3]]
    if len(blues) != cfg['nblue']:
        return False
    nums = list(row[2]) + list(blues)
    return all(1 <= x <= 99 for x in nums)


def diagnose():
    """只探测各数据源是否可达，不写任何文件"""
    print('[INFO] 代理: %s' % ('已启用' if _PROXY else '未使用（直连）'))
    for key, cfg in CFG.items():
        for label, fn in SOURCES[key]:
            t0 = time.time()
            try:
                rows = [r for r in fn() if valid(r, cfg)]
                if rows:
                    print('[ OK ] %-4s %-10s %3d 条  最新 %s  %.1fs'
                          % (cfg['name'], label, len(rows), rows[0][0], time.time() - t0))
                else:
                    print('[EMPTY] %-4s %-10s 返回内容里没有解析出有效记录' % (cfg['name'], label))
            except Exception as e:
                print('[FAIL] %-4s %-10s %s: %s'
                      % (cfg['name'], label, type(e).__name__, e))
    return 0


def main():
    if '--check' in sys.argv:
        return diagnose()
    os.makedirs(DATA, exist_ok=True)
    changed, failed = [], []

    for key, cfg in CFG.items():
        path = os.path.join(DATA, key + '.json')
        old = []
        if os.path.exists(path):
            try:
                old = json.load(io.open(path, encoding='utf-8'))
            except Exception:
                old = []

        fresh, used = [], None
        for label, fn in SOURCES[key]:
            try:
                rows = fn()
            except Exception as e:
                print('[WARN] %s 数据源 %s 失败: %s' % (cfg['name'], label, e))
                continue
            rows = [r for r in rows if valid(r, cfg)]
            if rows:
                fresh, used = rows, label
                break
            print('[WARN] %s 数据源 %s 返回空结果或格式不符' % (cfg['name'], label))

        if not fresh:
            print('[FAIL] %s 所有数据源都失败' % cfg['name'])
            failed.append(cfg['name'])
            continue

        merged = {r[0]: r for r in old}
        before = max(merged) if merged else 0
        for r in fresh:
            merged[r[0]] = r
        result = sorted(merged.values(), key=lambda r: r[0])
        new_codes = sorted(set(merged) - set(r[0] for r in old))
        after = max(merged) if merged else 0

        if after > before:
            io.open(path, 'w', encoding='utf-8').write(
                json.dumps(result, separators=(',', ':'), ensure_ascii=False))
            changed.append('%s +%d 期 (至 %d)' % (cfg['name'], len(new_codes), after))
            print('[NEW ] %s 最新 %d 期，新增 %s，共 %d 期（来源：%s）'
                  % (cfg['name'], after, new_codes, len(result), used))
        else:
            print('[SKIP] %s 无新开奖（最新仍是 %d 期，来源：%s）'
                  % (cfg['name'], before, used))

    if failed and len(failed) == len(CFG):
        return 1
    if changed:
        print('CHANGED:' + ' | '.join(changed))
        return 0
    return 2


if __name__ == '__main__':
    sys.exit(main())
