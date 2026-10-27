@echo off
chcp 65001 >nul
title อัปโหลดโค้ดขึ้น GitHub - Office Supplies System
cls
echo ========================================================
echo   กำลังอัปโหลดขึ้น https://github.com/flookoyza-star/office-supplies-system.git
echo ========================================================
echo.

git init
git branch -M main
git add .
git commit -m "Office Supplies Inventory and Requisition WebApp"

:: ลบ origin เก่าที่ผิดออก แล้วใส่ของ flookoyza-star
git remote remove origin >nul 2>nul
git remote add origin https://github.com/flookoyza-star/office-supplies-system.git

echo.
echo กำลัง Push โค้ดขึ้น GitHub...
git push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   [OK] อัปโหลดขึ้น GitHub สำเร็จเรียบร้อยแล้ว!
    echo ========================================================
) else (
    echo ========================================================
    echo   [!] หากยังขึ้น error:
    echo   1. ตรวจสอบว่าได้กดสร้าง Repository ชื่อ office-supplies-system บนเว็บ GitHub แล้วหรือยัง
    echo   2. ตรวจสอบหน้าต่าง Login ที่เด้งขึ้นมา
    echo ========================================================
)
echo.
pause
