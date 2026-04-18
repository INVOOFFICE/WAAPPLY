@echo off
setlocal EnableExtensions

REM ==================================================
REM WAAPPLY - UPDATE UPLOAD (daily changes)
REM ==================================================

cd /d "%~dp0"

set "REPO_URL=https://github.com/INVOOFFICE/WAAPPLY.git"
set "BRANCH=main"

if "%~1"=="" (
  set "COMMIT_MSG=chore: update waapply content"
) else (
  set "COMMIT_MSG=%~1"
)

echo.
echo [1/8] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git not found in PATH.
  pause
  exit /b 1
)

echo [2/8] Checking local repository...
if not exist ".git" (
  echo ERROR: .git not found. Run upload-full-reset.bat first.
  pause
  exit /b 1
)

echo [3/8] Setting origin...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)

echo [4/8] Staging updates...
git add -A .

echo [5/8] Commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo No new changes to commit.
)

echo [6/8] Pull rebase...
git branch -M %BRANCH%
git pull --rebase origin %BRANCH%
if errorlevel 1 (
  echo Rebase conflict detected. Resolve then re-run.
  pause
  exit /b 1
)

echo [7/8] Push...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo Push failed. Check auth/permissions.
  pause
  exit /b 1
)

echo [8/8] Done.
echo Updates uploaded successfully.
echo https://github.com/INVOOFFICE/WAAPPLY
pause

