@echo off
setlocal EnableExtensions

REM ==================================================
REM WAAPPLY - Upload ONLY ai-news project files
REM Target repo: https://github.com/INVOOFFICE/WAAPPLY
REM ==================================================

cd /d "%~dp0"

set "REPO_URL=https://github.com/INVOOFFICE/WAAPPLY.git"
set "BRANCH=main"

if "%~1"=="" (
  set "COMMIT_MSG=chore: update ai-news project"
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

echo [2/9] Ensuring isolated repo in this folder...
if not exist ".git" (
  echo No local .git found in ai-news. Initializing isolated repository...
  git init
  if errorlevel 1 (
    echo ERROR: git init failed.
    pause
    exit /b 1
  )
)

echo [3/9] Verifying repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: Not a valid Git repository in this folder.
  pause
  exit /b 1
)

echo [4/9] Setting origin...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)

echo [5/9] Staging ONLY ai-news project paths...
git add -A "index.html" "article.html" "style.css" "main.js" "news.json" "sitemap.xml" "feed.xml" "robots.txt" "contact.html" "privacy-policy.html" "terms-of-use.html" "upload-github.bat" "upload-ai-news-only.bat"
git add -A "scripts"
git add -A "ai-news-blog"
git add -A "articles"

echo [6/9] Optional status preview:
git status --short

echo [7/9] Commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo No new ai-news changes to commit. Will still try push.
)

echo [8/9] Syncing with remote branch (rebase)...
git branch -M %BRANCH%
git fetch origin %BRANCH% >nul 2>&1
if not errorlevel 1 (
  git pull --rebase origin %BRANCH%
  if errorlevel 1 (
    echo.
    echo Rebase failed (likely conflict).
    echo Resolve conflicts, then run:
    echo   git rebase --continue
    echo and re-run this script.
    pause
    exit /b 1
  )
)

echo [9/9] Push...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo Push failed. Check GitHub auth/permissions.
  pause
  exit /b 1
)

echo.
echo Success. Uploaded ai-news project only.
echo Repo: https://github.com/INVOOFFICE/WAAPPLY
pause

