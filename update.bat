@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 彩票数据更新

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
  where py >nul 2>nul && set "PY=py -3"
)
if not defined PY (
  echo [ERR ] 没找到 Python。
  echo        去 https://www.python.org/downloads/ 装一个，安装时勾选 "Add to PATH"。
  echo.
  pause
  exit /b 1
)

echo [INFO] 抓取数据（本机直连，不用代理）
%PY% update.py
set "CODE=%ERRORLEVEL%"

if "%CODE%"=="0" goto push
if "%CODE%"=="2" goto noupdate
goto fail

:push
where git >nul 2>nul
if errorlevel 1 (
  echo [ERR ] 没找到 git。
  echo        去 https://git-scm.com/download/win 装一个。
  echo.
  pause
  exit /b 1
)
git add data
git diff --staged --quiet
if not errorlevel 1 (
  echo [ OK ] 数据没有实际变化，跳过提交
  goto done
)
echo [INFO] 提交并推送
git commit -m "data: update"
git push
if errorlevel 1 (
  echo.
  echo [ERR ] 推送失败。若卡在连接（国内直连 GitHub 常见），给 git 单独配代理：
  echo        git config --global http.https://github.com.proxy socks5h://127.0.0.1:7890
  echo        端口按你节点实际的改。撤销：
  echo        git config --global --unset http.https://github.com.proxy
  echo.
  pause
  exit /b 1
)
echo [ OK ] 已推送，GitHub 会自动重建并部署，约 1 分钟后生效
goto done

:noupdate
echo [ OK ] 没有新开奖，无需更新
goto done

:fail
echo [ERR ] 抓取失败。先跑诊断看是哪个源的问题：
echo        %PY% update.py --check
echo.
pause
exit /b 1

:done
echo.
pause
