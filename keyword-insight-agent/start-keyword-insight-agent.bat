@echo off
setlocal
cd /d "%~dp0.."
set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
start "" "http://127.0.0.1:8766/keyword-insight-agent/insight-agent.html"
"%NODE_EXE%" "%CD%\naver-keyword-server.mjs"
