@echo off
REM Deploy njs-habsen via SSH host=ubuntu using tar (Windows has no rsync)
setlocal
set HOST=ubuntu
set REMOTE_DIR=/opt/njs-habsen
set TAR=%TEMP%\njs-habsen-deploy.tar.gz

echo ==^> Pack sources
tar -czf "%TAR%" --exclude node_modules --exclude dist --exclude .git --exclude .kilo --exclude .env --exclude coverage --exclude "*.log" --exclude "uploads" .
if errorlevel 1 exit /b 1

echo ==^> Upload
scp -q "%TAR%" %HOST%:/tmp/njs-habsen-deploy.tar.gz

echo ==^> Extract + build + up
ssh %HOST% "set -e; mkdir -p %REMOTE_DIR%; tar -xzf /tmp/njs-habsen-deploy.tar.gz -C %REMOTE_DIR%; cd %REMOTE_DIR%; test -f .env || cp .env.example .env; docker compose -f docker-compose.prod.yml build app; docker compose -f docker-compose.prod.yml up -d mysql; sleep 5; docker compose -f docker-compose.prod.yml up -d app; sleep 6"

echo ==^> Seed (idempotent)
ssh %HOST% "cd %REMOTE_DIR% && docker compose -f docker-compose.prod.yml --profile seed run --rm seed || true"

echo ==^> Smoke
ssh %HOST% "curl -sI http://127.0.0.1:3000/ui/login | head -3"
ssh %HOST% "curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"employee@demo.test\",\"password\":\"Password123!\"}' | head -c 200"

echo.
echo Done: %HOST%:%REMOTE_DIR%
endlocal
