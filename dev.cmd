@echo off
cd /d "%~dp0"
call npx vite --port 5188 --strictPort
