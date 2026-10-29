#!/usr/bin/env bash
# 本机一键更新：抓最新开奖 → 有新期则提交推送 → GitHub 自动重建部署
#
# 用法：
#   ./update.sh          正常跑（抓 + 推送）
#   ./update.sh --dry    只抓数据，不推送（想先本地看看效果）
#
# 说明：本机在国内，直连 500.com 和官网即可，不需要开代理。
#      只有 git push 卡住时才需要给 git 单独配代理，脚本会在失败时提示。

set -u
cd "$(dirname "$0")" || exit 1

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  echo "[ERR ] 没找到 Python。装一个再跑：https://www.python.org/downloads/"
  exit 1
fi

echo "[INFO] 抓取数据（本机直连，不用代理）"
"$PY" update.py
code=$?

if [ "$code" = "2" ]; then
  echo "[ OK ] 没有新开奖，无需更新"
  exit 0
fi
if [ "$code" != "0" ]; then
  echo "[ERR ] 抓取失败。先跑诊断看是哪个源的问题："
  echo "       $PY update.py --check"
  exit 1
fi

if [ "${1:-}" = "--dry" ]; then
  echo "[ OK ] 数据已更新（--dry 模式，未推送）"
  echo "       本地看效果：$PY build.py 然后打开 index.html"
  exit 0
fi

for need in git; do
  if ! command -v "$need" >/dev/null 2>&1; then
    echo "[ERR ] 没找到 $need"
    exit 1
  fi
done
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[ERR ] 当前目录不是 git 仓库"
  exit 1
fi

git add data
if git diff --staged --quiet; then
  echo "[ OK ] 数据没有实际变化，跳过提交"
  exit 0
fi

echo "[INFO] 提交并推送"
git commit -m "data: 更新开奖数据 $(date '+%Y-%m-%d %H:%M')" || exit 1

if ! git push; then
  echo
  echo "[ERR ] 推送失败。若卡在连接（国内直连 GitHub 常见），给 git 单独配代理："
  echo "       git config --global http.https://github.com.proxy socks5h://127.0.0.1:7890"
  echo "       端口按你节点实际的改。撤销："
  echo "       git config --global --unset http.https://github.com.proxy"
  exit 1
fi

echo "[ OK ] 已推送，GitHub 会自动重建并部署，约 1 分钟后生效"
