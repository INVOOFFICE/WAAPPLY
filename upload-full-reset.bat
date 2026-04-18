@echo off
setlocal EnableExtensions

REM ==================================================
REM WAAPPLY - FULL UPLOAD (all project files)
REM Use this after repository cleanup/reset.
REM ==================================================

cd /d "%~dp0"

set "REPO_URL=https://github.com/INVOOFFICE/WAAPPLY.git"
set "BRANCH=main"

if "%~1"=="" (
  set "COMMIT_MSG=feat: republish full waapply project"
) else (
  set "COMMIT_MSG=%~1"
)

echo.
echo [1/9] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git not found in PATH.
  pause
  exit /b 1
)

echo [2/9] Ensuring local repository...
if not exist ".git" (
  git init
  if errorlevel 1 (
    echo ERROR: git init failed.
    pause
    exit /b 1
  )
)

echo [3/9] Setting origin...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)

echo [4/9] Staging ALL files in ai-news folder...
git add -A .

echo [5/9] Commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo No changes to commit. Continuing...
)

echo [6/9] Setting branch...
git branch -M %BRANCH%

echo [7/9] Syncing with remote...
git fetch origin %BRANCH% >nul 2>&1
if not errorlevel 1 (
  git pull --rebase origin %BRANCH%
  if errorlevel 1 (
    echo Rebase conflict detected. Resolve conflicts then run again.
    pause
    exit /b 1
  )
)

echo [8/9] Push...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo Push failed. If remote history was rewritten, you may need manual review.
  pause
  exit /b 1
)

echo [9/9] Done.
echo Full project uploaded successfully.
echo https://github.com/INVOOFFICE/WAAPPLY
pause

