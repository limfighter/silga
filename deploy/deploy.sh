#!/usr/bin/env bash
# VM에서 최신 코드로 재배포할 때 실행. root로 실행할 것: sudo ./deploy.sh
# (최초 셋업은 deploy/README.md 참조 — 이 스크립트는 "업데이트"용)
#
# "sudo -u silga ./deploy.sh"로 실행하면 안 됨 — silga는 로그인 불가
# 시스템 계정이라 스크립트 내부의 systemctl(root 권한 필요)이 막힘.
# 그래서 이 스크립트는 root로 실행하고, 파일 작업(git pull/pip/npm)만
# 내부에서 silga 권한으로 낮춰서 처리함.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "root로 실행해야 함: sudo $0" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

sudo -u silga bash -c "
  set -euo pipefail
  cd '$REPO_DIR'
  git pull
  cd backend
  .venv/bin/pip install -q -r requirements.txt
  cd ../frontend
  npm install
  npm run build
"

systemctl restart silga-backend
systemctl reload nginx

echo "배포 완료"
