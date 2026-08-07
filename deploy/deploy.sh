#!/usr/bin/env bash
# VM에서 최신 코드로 재배포할 때 실행. /opt/silga에서 실행 가정.
# (최초 셋업은 deploy/README.md 참조 — 이 스크립트는 "업데이트"용)
set -euo pipefail
cd "$(dirname "$0")/.."

git pull

cd backend
source .venv/bin/activate
pip install -q -r requirements.txt
deactivate
cd ..

cd frontend
npm install
npm run build
cd ..

sudo systemctl restart silga-backend
sudo systemctl reload nginx

echo "배포 완료"
