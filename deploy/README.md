# GCP e2-micro 무료 티어 배포

개인용 단일 VM 배포. 프론트(정적 빌드)+백엔드(FastAPI) 둘 다 이 VM 하나에서
서빙 — nginx가 정적 파일을 직접 서빙하고 `/api/`만 로컬 uvicorn(127.0.0.1:8000)으로
리버스 프록시. 도메인/HTTPS 없이 VM 외부 IP로 바로 접속(HTTP)하는 걸 전제로
작성됨 — 나중에 도메인 생기면 certbot으로 HTTPS만 추가하면 됨.

무료 티어 조건(Always Free): e2-micro 인스턴스는 `us-west1`, `us-central1`,
`us-east1` 중 한 리전에서만 무료 — 다른 리전 쓰면 과금됨. 30GB 표준
영구디스크까지 무료.

## 1. VM 생성 (로컬 PC에서 gcloud 실행)

```bash
gcloud compute instances create silga-vm \
  --project=<YOUR_PROJECT_ID> \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --tags=http-server
```

`http-server` 태그를 인식할 기본 방화벽 규칙이 없으면 하나 만들기(프로젝트에
처음 VM 만드는 거면 필요할 수 있음):

```bash
gcloud compute firewall-rules create default-allow-http \
  --allow=tcp:80 \
  --target-tags=http-server \
  --direction=INGRESS
```

## 2. SSH 접속 + 기본 패키지 설치

```bash
gcloud compute ssh silga-vm --zone=us-central1-a
```

VM 안에서:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3-venv python3-pip nginx

# Node.js 20 LTS (Ubuntu 22.04 기본 apt는 버전이 낮아서 nodesource 사용)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. 앱 전용 시스템 유저 + 리포 클론

```bash
sudo useradd -r -m -d /opt/silga -s /usr/sbin/nologin silga
sudo -u silga git clone https://github.com/limfighter/silga.git /opt/silga
```

## 4. 백엔드 셋업

```bash
cd /opt/silga/backend
sudo -u silga python3 -m venv .venv
sudo -u silga .venv/bin/pip install -r requirements.txt
```

## 5. 프론트엔드 빌드

같은 오리진(nginx가 `/api/`로 프록시)으로 호출하도록 `VITE_API_BASE=/api`로
빌드해야 함 — 이러면 CORS 자체가 필요 없어짐(브라우저가 크로스 오리진으로
안 보니까).

```bash
cd /opt/silga/frontend
echo "VITE_API_BASE=/api" | sudo -u silga tee .env
sudo -u silga npm install
sudo -u silga npm run build
```

## 6. systemd 서비스 등록 (백엔드)

```bash
sudo cp /opt/silga/deploy/silga-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now silga-backend
sudo systemctl status silga-backend   # active (running) 확인
```

## 7. nginx 설정

```bash
sudo cp /opt/silga/deploy/nginx-silga.conf /etc/nginx/sites-available/silga
sudo ln -s /etc/nginx/sites-available/silga /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # 기본 페이지 제거
sudo nginx -t   # 문법 확인
sudo systemctl reload nginx
```

## 8. 접속 확인

```bash
gcloud compute instances describe silga-vm --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

위 IP로 브라우저에서 `http://<IP>/` 접속. `http://<IP>/api/docs`로 백엔드
Swagger UI도 확인 가능.

## 이후 업데이트

로컬에서 코드 바뀌고 push한 뒤, VM에 SSH 접속해서:

```bash
cd /opt/silga
sudo -u silga ./deploy/deploy.sh
```

(`deploy.sh`가 git pull + 의존성 재설치 + 프론트 재빌드 + 서비스 재시작까지
전부 처리 — `sudo` 필요한 systemctl 명령만 스크립트 안에서 별도로 sudo 호출함,
나머지는 실행 유저 그대로)

## 참고

- DB 파일(`backend/ppe.db`, SQLite)은 VM 로컬 디스크에만 있음 — VM 삭제하면
  데이터도 같이 날아감. 개인 도구라 백업 자동화는 하지 않음(필요하면 그때
  `scp`로 수동 백업)
- 로그 확인: `sudo journalctl -u silga-backend -f`
- 매너 크롤링 원칙(요청 간격 5~10초)은 배포 환경에서도 동일하게 적용됨 —
  VM 자체 성능과는 무관한 제약(CLAUDE.md 참조)
