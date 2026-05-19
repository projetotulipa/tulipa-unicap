@echo off
REM Sobe um servidor estatico local pra testar o site TULIPA (admin + LPs).
REM Acesse:
REM   http://localhost:8000/             -> site publico
REM   http://localhost:8000/admin/       -> painel admin
REM
REM Encerra com Ctrl+C

cd /d "%~dp0"
"C:\Users\gabri\AppData\Local\Python\bin\python.exe" -m http.server 8000
