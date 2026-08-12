@echo off
chcp 65001 >nul

echo 启动 NestJS 后端...

start "AI后端" cmd /k "cd /d C:\Users\延阁\Desktop\毕业设计\server && npm run start:dev"


timeout /t 5 >nul


echo 启动 Vue 前端...

start "AI前端" cmd /k "cd /d C:\Users\延阁\Desktop\毕业设计 && npm run dev"

exit