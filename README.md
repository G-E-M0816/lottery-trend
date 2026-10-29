# 双色球 / 大乐透 走势分析

一个纯静态的单页工具：历史走势图、遗漏与冷热统计、形态分析、节奏推演选号。双色球和大乐透共用一条链接，顶部切换。

数据每天自动更新，不需要手动维护。

---

## 部署（4 步）

### 1. 建仓库并推代码

```bash
git init
git add -A
git commit -m "init"
git branch -M main
git remote add origin git@github.com:<你的用户名>/lottery-trend.git
git push -u origin main
```

### 2. 打开 Pages

仓库页 → **Settings** → 左侧 **Pages** → Source 选 **GitHub Actions**。

### 3. 手动跑一次

仓库页 → **Actions** → 左侧「更新开奖数据」→ 右侧 **Run workflow**。

跑完大约 1 分钟，Pages 会给出访问地址：

```
https://<你的用户名>.github.io/lottery-trend/
```

### 4. 之后就不用管了

每天北京时间 22:30 自动跑：抓最新开奖 → 重建页面 → 部署。

---

## 它怎么更新的

```
update.py   抓最新开奖（500.com 优先，官网接口兜底）
   ↓        按期号增量合并进 data/*.json
build.py    把 data 和 src 拼成单文件 index.html
   ↓
Actions     部署到 Pages
```

**增量逻辑**：只拉最近 100 期，跟库里已有的期号比，没有新期就直接跳过——不构建、不部署、不产生提交。

**失败保护**：数据校验不过（号码越界、条数不对、解析为空）就整体放弃，线上保持旧版本，不会把页面搞坏。

**数据体积**：仓库里只有 `data/*.json`（约 350KB），每次更新只增加一期（约 200 字节）。`index.html` 是构建产物，不进仓库。

---

## 手动更新

本地想跑一次：

```bash
python update.py   # 抓数据，退出码 0=有新数据 1=失败 2=无新数据
python build.py    # 生成 index.html，本地打开就能看效果
```

想只检查数据源通不通（不写文件）：

```bash
python update.py --check
```

推送 `data/` 的变更会触发 workflow 重新部署，所以本地抓完 `git push` 就完事。

---

## 网络这块要不要管

不用。这套配置**不需要代理，也不需要你本机的梯子**。

抓取走的是 500.com 的开奖历史页，这个站对境内外 IP 都开放，GitHub 的海外 runner 能正常拉。这不是推测：有个开源仓库（`gudaoxuri/lottery_history`）用同一个地址、同一个抓法，在 GitHub Actions 上长期跑着，数据更新到昨天那期。所以 `update.py` 的数据源顺序也改成了 **500.com 优先，官网接口兜底**。

官网接口退到第二位是有理由的：`cwl.gov.cn` 对境外机房 IP 会返回 403——是主动拒绝，不是网络不通。国内访问完全正常，所以国内跑的时候两个源都是零点几秒响应。既然要选一个放前面，就选两边都能通的那个。

### 你的梯子用在哪

只可能用在 `git push` 上。国内直连 GitHub 有时会卡在 443，这时候给 git 单独配代理：

```bash
git config --global http.https://github.com.proxy socks5h://127.0.0.1:7890
```

用完想去掉：

```bash
git config --global --unset http.https://github.com.proxy
```

注意这只是让 `git push` 走代理，跟 Actions 那边抓数据完全无关——两边是独立的两件事。

### 万一两个源都不通

代码里留着代理开关，但先按这个顺序排查：

1. 看 Actions 日志第一步的诊断，确认是超时、403 还是「接口改版」
2. 如果是网络，把抓取搬到本机（下一节），最省事
3. 确实要走代理，再配 Secret：Name 填 `LOTTERY_PROXY`，值必须是**公网可达**的地址（`http://user:pass@1.2.3.4:8080`），`127.0.0.1:7890` 这种本机地址没用，runner 在云端访问不到你电脑

## 把抓取搬到本机（可选）

你本机在国内，两个源都是直连秒回，**不用开节点**：

```bash
python update.py    # 抓数据，写进 data/*.json
python build.py     # 可选，本地先看看效果
git add data && git commit -m "data" && git push
```

推送会触发 workflow 重新构建部署——`data/**` 在触发路径里。等于把「抓数据」搬到国内，GitHub 只负责托管和构建。

想让它每天自动跑，给自己挂个系统定时任务：

| 系统 | 做法 |
|---|---|
| Windows | 任务计划程序 → 创建基本任务 → 每天 22:40 → 启动程序 → 选 `update.bat` |
| macOS | `launchd` 或 `crontab -e` 加 `40 22 * * * cd /路径/lottery-gh && ./update.sh` |
| Linux | 同上，crontab 一行 |

`update.bat` / `update.sh` 是配套的一键脚本，会自动抓数据、有变化才提交推送，没变化就直接退出。

---

## 常见问题

**Q：到点了但数据没更新？**

GitHub 的定时任务有 5-20 分钟延迟，高峰期更久。等一会儿，或者去 Actions 页面手动 Run 一次。

**Q：Actions 报「所有数据源都抓取失败」？**

先去日志看是哪个源、报什么错：

- **`HTTP Error 403`** → 官网对境外机房 IP 的主动拒绝。这是预期内的，正常情况下走 500.com 就够了，不会走到这一步。
- **`URLError: timed out`** → 网络连不上。少见，因为 500.com 在境外可用。
- **返回内容为空 / 格式不符** → 对方改版了，需要更新 `update.py` 里的解析逻辑。

全都失败的话，最省事的是把抓取搬到本机跑一次再 push，见上面「把抓取搬到本机」。

**Q：怎么判断是不是网络问题？**

手动 Run 一次，第一步就是连通性诊断，会打印四个数据源各自的结果：

```
[INFO] 代理: 未使用（直连）
[ OK ] 双色球  500.com     80 条  最新 26124  0.2s
[ OK ] 双色球  福彩官网       100 条  最新 26124  0.2s
[ OK ] 大乐透  500.com     80 条  最新 26123  0.3s
[ OK ] 大乐透  体彩官网       100 条  最新 26123  0.1s
```

在海外 runner 上跑，实际是长这样（2026-10-30 实测）：

```
[INFO] 代理: 未使用（直连）
[ OK ] 双色球  500.com     80 条  最新 26124  1.6s
[FAIL] 双色球  福彩官网       HTTPError: HTTP Error 403: Forbidden
[ OK ] 大乐透  500.com     80 条  最新 26123  21.0s
[FAIL] 大乐透  体彩官网       HTTPError: HTTP Error 567: Unknown Status
```

两个官网都是主动拒绝境外 IP（403 / 567），500.com 两个彩种都拿到了。脚本在第一个源成功后就停手，所以后面那两行 FAIL 不影响更新。大乐透那个 21 秒是 500.com 偶尔慢，超时设了 30 秒兜着。

出问题时：

| 日志 | 含义 | 怎么办 |
|---|---|---|
| `HTTP Error 403` / `567` | 官网拒绝境外 IP | 正常现象，忽略 |
| `URLError: timed out` | 连不上 | 见「把抓取搬到本机」 |
| `URLError: Connection refused` | 代理地址不对或没启动 | 检查代理配置 |
| `[EMPTY] 返回内容里没有解析出有效记录` | 接口改版了 | 需要改 `update.py` 的解析逻辑 |
| `JSONDecodeError` | 返回的不是 JSON | 同上，或被拦截返回了错误页 |

**Q：想改更新时间？**

改 `.github/workflows/update.yml` 里的 cron。格式是 UTC，北京时间减 8 小时：

| 北京时间 | cron |
|---|---|
| 22:30 | `30 14 * * *` |
| 23:00 | `0 15 * * *` |
| 21:45 | `45 13 * * *` |

**Q：为什么每天 22:30？**

双色球 21:15 开奖、大乐透 20:30 开奖，这个点两边数据都已出。周五两个彩种都不开奖，脚本会自己跳过。

**Q：仓库 60 天没动，定时任务会停吗？**

GitHub 会停用长期无活动的仓库的定时任务。但这个仓库每周都有数据提交，不会触发。

---

## 目录

```
├── index.html              构建产物（不进仓库，部署时生成）
├── data/
│   ├── ssq.json            双色球历史开奖（3521 期）
│   └── dlt.json            大乐透历史开奖（2941 期）
├── src/
│   ├── ssq/                双色球页面模板与脚本
│   └── dlt/                大乐透页面模板与脚本
├── build.py                构建脚本
├── update.py               数据抓取脚本
├── update.sh               本机一键更新（macOS / Linux）
├── update.bat              本机一键更新（Windows，双击即可）
└── .github/workflows/
    └── update.yml          定时更新 + 部署
```

数据格式：`[期号, 日期(YYYYMMDD), 红球数组, 蓝球, 奖池, 一等奖单注奖金]`

---

## 数据来源

- 双色球：中国福利彩票官网、500.com 历史数据
- 大乐透：中国体育彩票官网、500.com 历史数据

仅供研究与娱乐。彩票每期独立随机，任何分析方法都无法预测结果，请理性购彩。
