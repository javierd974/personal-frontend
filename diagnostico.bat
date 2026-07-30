@echo off
title SmartDom Kiosco - Diagnostico del lector
color 0B
echo.
echo  Revisando el estado del lector y reportando al tablero...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0diagnostico.ps1"
echo.
pause
