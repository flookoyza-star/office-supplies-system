@echo off
chcp 65001 >nul
title GitHub Uploader - Office Supplies System
cls
echo =======================================================================
echo   Office Supplies Inventory and Requisition System
echo   GitHub: https://github.com/flookoyza-star/office-supplies-system.git
echo =======================================================================
echo.

git add .
git commit -m "Add responsive Card Views for Mobile and Tablet and Modern UI enhancements"
echo.
echo [*] กำลังส่งโค้ดขึ้น GitHub (git push -u origin main)...
git push -u origin main

if %errorlevel% equ 0 goto success
goto failed

:success
echo.
echo =======================================================================
echo   [OK] อัปโหลดโค้ดขึ้น GitHub สำเร็จเรียบร้อยแล้ว
echo   ตรวจสอบได้ที่: https://github.com/flookoyza-star/office-supplies-system
echo =======================================================================
goto end

:failed
echo.
echo =======================================================================
echo   [X] การ Push ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
echo =======================================================================
goto end

:end
echo.
pause
