@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   ResearchOS V1  论文分析工作台
echo   启动后浏览器打开 http://127.0.0.1:8000
echo ==========================================
node server\server.js
pause
