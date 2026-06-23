@echo off
title ParFi - Editeur (laisse cette fenetre ouverte)
cd /d "%~dp0"
echo.
echo  ===================================================
echo   ParFi - Editeur visuel
echo   L'editeur s'ouvre dans ton navigateur...
echo   Garde CETTE fenetre ouverte pendant que tu bosses.
echo   Pour arreter : ferme cette fenetre.
echo  ===================================================
echo.
start "" http://localhost:5050/
set "PY=C:\Users\YANN\AppData\Local\Programs\Python\Python312\python.exe"
if exist "%PY%" ( "%PY%" -m http.server 5050 ) else ( python -m http.server 5050 )
