@echo off
chcp 65001 >nul
title อัปโหลดโค้ดขึ้น GitHub - Office Supplies System
cls
echo ========================================================
echo   ระบบอัปโหลดโปรเจกต์ขึ้น GitHub อัตโนมัติ
echo   Office Supplies Inventory & Requisition System
echo ========================================================
echo.

:: ตรวจสอบว่ามี Git หรือไม่
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] ไม่พบโปรแกรม Git ในเครื่องของคุณ
    echo     กรุณาดาวน์โหลดและติดตั้ง Git จาก: https://git-scm.com/downloads
    echo.
    pause
    exit /b
)

echo [1/4] ตรวจสอบสถานะ Git ในโฟลเดอร์...
if not exist ".git" (
    echo [*] เริ่มต้น Git Repository (git init)...
    git init
    git branch -M main
) else (
    echo [*] มี Git Repository อยู่แล้ว
)

echo.
echo [2/4] รวบรวมไฟล์และบันทึก Commit...
git add .
git commit -m "Office Supplies Inventory and Requisition WebApp"

echo.
echo ========================================================
echo   กรุณาสร้าง Repository บน GitHub (https://github.com/new)
echo   แล้วคัดลอกลิงก์ HTTPS ของคุณมาวางด้านล่าง
echo   ตัวอย่าง: https://github.com/your-username/office-supplies.git
echo ========================================================
echo.
set /p REPO_URL="วางลิงก์ GitHub Repo ที่นี่ แล้วกด Enter: "

if "%REPO_URL%"=="" (
    echo [!] ไม่ได้ระบุลิงก์ กรุณาลองใหม่อีกครั้ง
    pause
    exit /b
)

echo.
echo [3/4] เชื่อมต่อกับ GitHub Remote...
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

echo.
echo [4/4] กำลัง Push โค้ดขึ้น GitHub...
git push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   [OK] อัปโหลดขึ้น GitHub สำเร็จเรียบร้อยแล้ว!
    echo ========================================================
) else (
    echo ========================================================
    echo   [!] หากเกิดข้อผิดพลาดในการ Push:
    echo   1. ตรวจสอบว่าล็อกอิน GitHub ในเครื่องแล้วหรือยัง
    echo   2. ตรวจสอบว่าใส่ลิงก์ Repository ถูกต้องหรือไม่
    echo ========================================================
)
echo.
pause

