@echo off
setlocal EnableExtensions

REM =========================================
REM WAAPPLY - One-click GitHub uploader
REM Repo: https://github.com/INVOOFFICE/WAAPPLY
REM Usage:
REM   upload-github.bat
REM   upload-github.bat "your commit message"
REM =========================================

cd /d "%~dp0"

set "REPO_URL=https://github.com/INVOOFFICE/WAAPPLY.git"
set "BRANCH=main"

if "%~1"=="" (
  set "COMMIT_MSG=chore: update waapply content"
) else (
  set "COMMIT_MSG=%~1"
)

echo.
echo [1/7] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git is not installed or not in PATH.
  pause
  exit /b 1
)

echo [2/7] Verifying repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: This folder is not a Git repository.
  echo Run this once manually in this folder:
  echo   git init
  pause
  exit /b 1
)

echo [3/7] Configuring origin remote...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)

echo [4/7] Staging files...
git add .

echo [5/7] Creating commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo No new changes to commit, continuing to push...
)

echo [6/7] Ensuring branch is %BRANCH%...
git branch -M %BRANCH%

echo [7/7] Pushing to GitHub...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo.
  echo Push failed. Check:
  echo - GitHub authentication (PAT or Git Credential Manager)
  echo - Access rights to INVOOFFICE/WAAPPLY
  pause
  exit /b 1
)

echo.
echo Success! Project uploaded to:
echo https://github.com/INVOOFFICE/WAAPPLY
pause

