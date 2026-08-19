@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "FRONTEND_PORT=5173"
set "BACKEND_PORT=3000"

call :is_port_open %BACKEND_PORT%
if errorlevel 1 (
  echo 启动 NestJS 后端...
  start "AI后端" /d "%ROOT%server" cmd /k npm run start:dev
) else (
  echo NestJS 后端已运行。
)

call :is_port_open %FRONTEND_PORT%
if errorlevel 1 (
  echo 启动 Vue 和 Electron 开发服务...
  start "AI前端" /d "%ROOT%" cmd /k npm run dev
  call :wait_for_port %FRONTEND_PORT% 25
  if errorlevel 1 goto frontend_unavailable

  echo 等待 Vite 自动启动 Electron...
  call :wait_for_electron 25
  if not errorlevel 1 goto launched
) else (
  echo Vue 开发服务已运行。
)

call :is_electron_running
if not errorlevel 1 goto launched

echo Electron 未运行，正在启动恢复实例...
start "LumiDesk" /min /d "%ROOT%" cmd /c "set VITE_DEV_SERVER_URL=http://localhost:%FRONTEND_PORT%^&^& node node_modules\electron\cli.js . --no-sandbox"
call :wait_for_electron 12
if not errorlevel 1 goto launched
goto electron_unavailable

:launched
echo LumiDesk 已启动。
endlocal
exit /b 0

:frontend_unavailable
echo Vue 开发服务未能在 25 秒内启动，请检查“AI前端”窗口的错误信息。
goto launch_failed

:electron_unavailable
echo Electron 未能启动，请检查“AI前端”窗口或项目依赖是否报错。

:launch_failed
pause
endlocal
exit /b 1

:is_port_open
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul
exit /b %errorlevel%

:wait_for_port
set /a ATTEMPTS=0
:wait_for_port_loop
call :is_port_open %~1
if not errorlevel 1 exit /b 0
set /a ATTEMPTS+=1
if !ATTEMPTS! GEQ %~2 exit /b 1
powershell -NoProfile -Command "Start-Sleep -Seconds 1"
goto wait_for_port_loop

:is_electron_running
powershell -NoProfile -Command "$root=[IO.Path]::GetFullPath('%ROOT%').TrimEnd('\'); $process=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -and $_.CommandLine -match [regex]::Escape($root) } | Select-Object -First 1; if ($process) { exit 0 }; exit 1"
exit /b %errorlevel%

:wait_for_electron
set /a ATTEMPTS=0
:wait_for_electron_loop
call :is_electron_running
if not errorlevel 1 exit /b 0
set /a ATTEMPTS+=1
if !ATTEMPTS! GEQ %~1 exit /b 1
powershell -NoProfile -Command "Start-Sleep -Seconds 1"
goto wait_for_electron_loop
