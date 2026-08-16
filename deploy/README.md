# GCP 배포 — 서울(asia-northeast3), 무료 체험 크레딧으로 운용 (2026-08-15)

개인용 단일 VM 배포. 프론트(정적 빌드)+백엔드(FastAPI) 둘 다 이 VM 하나에서
서빙 — nginx가 정적 파일을 직접 서빙하고 `/api/`만 로컬 uvicorn(127.0.0.1:8000)으로
리버스 프록시. 도메인/HTTPS 없이 VM 외부 IP로 바로 접속(HTTP)하는 걸 전제로
작성됨 — 나중에 도메인 생기면 certbot으로 HTTPS만 추가하면 됨.

## 리전 선택 — 왜 무료 티어(us-central1)가 아니라 서울인가

Always Free e2-micro는 `us-west1`/`us-central1`/`us-east1` 3개 리전에서만
적용된다. 서울(`asia-northeast3`)로 옮기면 이 무료 조건이 전부 사라지고
VM·디스크·외부IP가 실비로 과금된다 — 대신 사용자 응답속도와 다나와
스크래핑 왕복 지연이 크게 줄어든다(다나와가 국내 서비스라서). 이 트레이드를
감당하는 건 **GCP 신규 가입 90일 $300 무료 체험 크레딧** — Always Free
사용량은 이 크레딧을 안 깎지만, 서울에서는 전부 크레딧 소모 대상이다.

같은 결제 계정에서 다른 워크로드(IAP/트레이딩봇)가 이미 하루 4천~1만원대를
쓰고 있어서 크레딧이 1.5~2개월 내 소진될 전망(2026-08-15 실측 기반 추정,
정확한 잔액은 콘솔 결제→개요에서 수시 확인 필요) — **이 서울 구성은
크레딧이 있는 동안만 유효한 임시 배치다.** 크레딧 소진이 가까워지면 "9.
비용 확인 + 크레딧 소진 전 되돌리기" 절차대로 us-central1 무료 티어로
되돌릴 것.

비용을 하루 300~500원대로 맞추려고 VM을 24시간이 아니라 **08:00~20:00
(KST)만 자동 가동**하고, 그 밖의 시간은 필요할 때 수동으로 켠다(둘 다
아래 "1-1. 인스턴스 스케줄" 참조). RAM 2GB(e2-small)로 올리는 안은
24시간 상시 기준 예산 초과라 보류하고, e2-micro(RAM 1GB)를 유지하는
대신 OOM 방지용 스왑 파일을 둔다(아래 "2. SSH 접속" 하단 참조).

**외부 IP는 고정(static)으로 승격해서 쓴다**(아래 "1-2. 외부 IP 고정"
참조) — ephemeral IP는 VM이 꺼지면 회수되고 다음에 켤 때 다른 주소가
배정될 수 있어서, 매일 스케줄로 껐다 켜면 접속 주소가 계속 바뀐다.
단, GCP는 인스턴스에 붙어있는 고정 IP는 **VM이 꺼져 있어도 "사용 중"
요금(시간당 $0.005)이 24시간 그대로 붙는다**(반대로 아무 리소스에도
안 붙은 예약 전용 고정 IP는 2배인 시간당 $0.01) — 그래서 스케줄
12시간만 도는 컴퓨팅·디스크와 달리 IP 비용만 24시간분으로 계산해야
한다. 합산하면:

| 항목 | 계산 | 일일 비용 |
|---|---|---|
| 컴퓨팅(e2-micro, 12시간) | $0.0107×12 | 182원 |
| 외부 IP(고정, 24시간 상주) | $0.005×24 | 170원 |
| 디스크(20GB, 24시간 상주) | $0.046/GB·월 | 43원 |
| **합계** | | **약 395원/일** |

예산(300~500원) 안에 여전히 들어온다(상단 여유 105원).

무료 티어(us-central1)로 되돌릴 때 적용되는 조건(참고용, 지금 서울
구성에는 해당 없음):
- e2-micro 인스턴스 1개, `us-west1`/`us-central1`/`us-east1`에서만 무료
- 영구디스크 30GB까지 무료 — **단 타입이 반드시 Standard(HDD, `pd-standard`)여야
  함.** gcloud 최신 버전은 `--boot-disk-type`을 안 주면 기본값이
  `pd-balanced`라 그냥 두면 과금됨
- **외부 IP는 2024-02-01부터 무료 티어에서 빠짐** — static/ephemeral
  무관하게 실행 중인 표준 VM에 붙은 외부 IPv4는 시간당 $0.005 과금(월
  1시간만 무료). us-central1이어도 이 부분은 24시간 기준 약 170원/일이
  항상 과금됨 — 이 문서에 예전엔 "임시 IP는 무료"라고 적혀 있었는데
  틀린 서술이었음(2026-08-15 정정)
- 네트워크 아웃바운드 월 1GB까지 무료, 그 이상은 소액 과금

## 1. VM 생성 (로컬 PC에서 gcloud 실행)

서울 리전은 무료 티어 대상이 아니라서 30GB(무료 한도)를 채울 이유가
없음 — 실제 쓸 만큼(20GB)만 잡아서 디스크 비용을 줄인다.

```bash
gcloud compute instances create silga-vm \
  --project=<YOUR_PROJECT_ID> \
  --zone=asia-northeast3-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-standard \
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

## 1-1. 인스턴스 스케줄 (08:00~20:00 KST 자동 on/off) + 수동 오버라이드

24시간 상시 가동은 이 리전에서 예산(하루 300~500원)을 넘기므로, 매일
08:00에 자동 시작·20:00에 자동 종료되도록 리소스 정책을 건다(스케줄
로직을 VM 안에 직접 스크립트로 넣지 않고 GCP 내장 기능을 쓰는 것 —
관리 포인트를 늘리지 않기 위함):

```bash
gcloud compute resource-policies create instance-schedule silga-8to20 \
  --project=<YOUR_PROJECT_ID> \
  --region=asia-northeast3 \
  --vm-start-schedule="0 8 * * *" \
  --vm-stop-schedule="0 20 * * *" \
  --timezone="Asia/Seoul"

gcloud compute instances add-resource-policies silga-vm \
  --zone=asia-northeast3-a \
  --resource-policies=silga-8to20
```

스케줄 밖(20:00~08:00)에 쓸 일이 있으면 그때그때 수동으로 켜고, 안 쓸
것 같으면 자동 종료를 기다리지 않고 바로 끈다:

```bash
# 켜기 (완전 부팅까지 약 20~60초 소요 — e2-micro라 다소 걸림)
gcloud compute instances start silga-vm --zone=asia-northeast3-a

# 끄기
gcloud compute instances stop silga-vm --zone=asia-northeast3-a
```

디스크는 정지 중에도 유지되므로 SQLite DB(`backend/ppe.db`)는 껐다 켜도
안전함.

## 1-2. 외부 IP 고정 (ephemeral IP가 재기동마다 바뀌는 문제 해결)

도메인 없이 IP로 직접 접속하는 구성이라(위 개요 참조), 매일 스케줄로
껐다 켜는데 IP가 계속 바뀌면 접속할 때마다 콘솔에서 새 주소를 확인해야
해서 실용성이 떨어진다. VM 생성 직후, 지금 붙어있는 ephemeral IP를
그대로 고정(static)으로 승격한다 — 주소 자체는 안 바뀜:

```bash
# 현재 배정된 ephemeral IP 확인
gcloud compute instances describe silga-vm --zone=asia-northeast3-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'

# 그 주소를 그대로 고정 IP로 승격
gcloud compute addresses create silga-ip \
  --project=<YOUR_PROJECT_ID> \
  --region=asia-northeast3 \
  --addresses=<위에서 확인한 IP>
```

이후 인스턴스를 껐다 켜도 이 IP로 고정 유지됨. 대신 GCP는 인스턴스에
붙은 고정 IP를 **VM이 꺼져 있어도 "사용 중" 요금으로 24시간 과금**하므로
(위 "리전 선택" 절 비용표 참조), 스케줄로 꺼진 12시간에도 IP 비용은
계속 나간다는 점 감안할 것.

## 2. SSH 접속 + 기본 패키지 설치

```bash
gcloud compute ssh silga-vm --zone=asia-northeast3-a
```

VM 안에서:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3-venv python3-pip nginx

# Node.js 20 LTS (Ubuntu 22.04 기본 apt는 버전이 낮아서 nodesource 사용)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x 확인 — v12.x 등 구버전이 나오면 아래로 재설치
```

**`node -v`가 v20.x가 아니면**(nodesource 저장소 등록이 실패하고 Ubuntu
기본 저장소의 구버전이 깔린 경우, 2026-08-16 실제 발생) 지우고 다시:

```bash
sudo apt remove -y nodejs npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### 스왑 파일 설정 (OOM 방지, 강력 권장)

e2-micro는 RAM이 1GB뿐이라 실사용 중 OOM으로 SSH까지 먹통이 된 사례가
있었음(2026-08-08, `실가_인수인계.md` 참조). 스왑 2GB를 잡아두면
완전히 막지는 못해도 급격한 OOM kill 빈도를 크게 줄인다:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # Swap 2.0Gi 확인
```

## 3. 앱 전용 시스템 유저 + 리포 클론

```bash
sudo useradd -r -m -d /opt/silga -s /usr/sbin/nologin silga
```

**`useradd -m`이 `/etc/skel`의 숨김파일(.bashrc 등)로 홈 디렉토리를 채워서
"비어있지 않다"고 git이 클론을 거부한다(2026-08-16 실제 발생)** — 클론
전에 정리부터:

```bash
sudo find /opt/silga -mindepth 1 -maxdepth 1 -exec rm -rf {} \;
sudo -u silga git clone https://github.com/limfighter/silga.git /opt/silga
```

## 4. 백엔드 셋업

`/opt/silga`가 `silga` 전용 홈이라 로그인 계정으로 `cd`가 안 됨(권한
거부) — `sudo -u silga bash -c "..."`로 한 번에 묶어서 실행할 것:

```bash
sudo -u silga bash -c "cd /opt/silga/backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
```

## 5. 프론트엔드 빌드

같은 오리진(nginx가 `/api/`로 프록시)으로 호출하도록 `VITE_API_BASE=/api`로
빌드해야 함 — 이러면 CORS 자체가 필요 없어짐(브라우저가 크로스 오리진으로
안 보니까).

```bash
sudo -u silga bash -c "cd /opt/silga/frontend && echo 'VITE_API_BASE=/api' > .env && npm install && npm run build"
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

**nginx(www-data)가 `/opt/silga` 홈 디렉토리 권한 때문에 정적 파일까지
못 들어가서 500 에러가 나는 경우 있음(2026-08-16 실제 발생, "500
Internal Server Error" + 에러 로그에 `stat() ... Permission denied`)** —
`backend/`(DB 포함)는 그대로 잠가두고 `frontend/dist`만 딱 필요한 만큼
연다:

```bash
sudo chmod o+x /opt/silga
sudo chmod o+x /opt/silga/frontend
sudo chmod -R o+rX /opt/silga/frontend/dist
sudo nginx -t && sudo systemctl reload nginx
```

## 8. 접속 확인

```bash
gcloud compute instances describe silga-vm --zone=asia-northeast3-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

위 IP로 브라우저에서 `http://<IP>/` 접속. `http://<IP>/api/docs`로 백엔드
Swagger UI도 확인 가능.

## 9. 비용 확인 + 크레딧 소진 전 되돌리기

서울은 무료 티어가 아니라서 "0원인지" 확인하는 게 아니라 **예상 범위
(스케줄 12시간 + 고정 IP 24시간분 기준 약 395원/일) 안에서 도는지,
크레딧이 얼마나 남았는지**를 주기적으로 확인해야 한다.

- 결제(Billing) → 개요에서 "남은 크레딧"과 만료일 확인 — 90일 트라이얼
  만료일과 크레딧 소진 시점 중 먼저 오는 쪽이 실질 데드라인
- 결제 → 보고서(Reports)에서 서비스 필터를 "Compute Engine"만 남기고
  일일 비용이 대략 300~500원대인지 확인. 크게 벗어나면(예:
  `--boot-disk-type` 실수로 `pd-balanced`가 붙었거나, 1-1번 스케줄이
  안 걸려 24시간 그대로 도는 경우) 1번/1-1번/1-2번 단계를 재확인

### 크레딧 소진 임박 시: us-central1 무료 티어로 되돌리기

1. DB 백업이 필요하면 먼저 로컬로 내려받기 — **SQLite가 WAL 모드라
   `ppe.db` 하나만 받으면 최근 데이터가 빠진다(`ppe.db-wal`에 있음,
   2026-08-16 실제로 이 파일 하나만 받았다가 빈 DB로 보였던 사례 있음).
   세 파일(`ppe.db`, `ppe.db-wal`, `ppe.db-shm`) 전부 같이 받을 것:**
   ```bash
   # 원본 VM에서 먼저 읽기 권한 있는 위치로 복사 (쓰기 중 스냅샷 어긋남 방지로 서비스 잠깐 정지)
   gcloud compute ssh silga-vm --zone=asia-northeast3-a --command="
     sudo systemctl stop silga-backend
     sudo cp /opt/silga/backend/ppe.db /opt/silga/backend/ppe.db-wal /opt/silga/backend/ppe.db-shm /tmp/
     sudo chmod 644 /tmp/ppe.db /tmp/ppe.db-wal /tmp/ppe.db-shm
     sudo systemctl start silga-backend
   "
   # 로컬(또는 Cloud Shell 홈)로 세 파일 다 내려받기
   gcloud compute scp silga-vm:/tmp/ppe.db silga-vm:/tmp/ppe.db-wal silga-vm:/tmp/ppe.db-shm ~/ --zone=asia-northeast3-a
   ```
2. 이 문서의 "1. VM 생성"~"8. 접속 확인"을 `--zone=us-central1-a`,
   `--boot-disk-size=30GB`(무료 한도까지)로 그대로 다시 실행해 새 VM을
   만든다. 백업한 세 파일이 있으면 새 VM의 `/opt/silga/backend/`에
   전부 scp로 올리고 `sudo chown silga:silga /opt/silga/backend/ppe.db*`로
   소유권 맞춰서 교체 (하나라도 빠지면 데이터 유실 — 옮긴 뒤 `sqlite3`나
   파이썬으로 `SELECT COUNT(*) FROM builds` 등으로 실제 개수 확인 권장)
3. "1-1. 인스턴스 스케줄"과 "1-2. 외부 IP 고정"은 둘 다 생략해도 됨 —
   us-central1은 24시간 상시가 무료라 스케줄을 걸 이유가 없고, VM이
   안 꺼지니 ephemeral IP도 회수될 일이 없어 그대로 안정적임(단, 외부
   IP 과금 약 170원/일은 리전과 무관하게 계속 남음, 위 "리전 선택" 절 참조)
4. 서울 VM(`silga-vm`, 존 `asia-northeast3-a`)은 확인 후 삭제:
   `gcloud compute instances delete silga-vm --zone=asia-northeast3-a`

## 이후 업데이트

로컬에서 코드 바뀌고 push한 뒤, VM에 SSH 접속해서:

```bash
cd /opt/silga
sudo ./deploy/deploy.sh
```

**주의: 반드시 `sudo ./deploy/deploy.sh`(root로 실행)여야 함 —
`sudo -u silga ./deploy.sh`로 실행하면 안 됨.** silga는 로그인 불가
시스템 계정이라, 그렇게 실행하면 스크립트 내부의 systemctl 호출이 다시
sudo 승격을 시도하다가 비밀번호가 없어서 막힘. `deploy.sh`는 root로
시작해서 파일 작업(git pull/pip/npm)만 내부적으로 `sudo -u silga`로
낮춰서 처리하고, systemctl은 이미 root 상태 그대로 실행하는 구조로
되어 있음.

**nginx나 systemd 설정 파일 자체(`nginx-silga.conf`, `silga-backend.service`)를
바꾼 업데이트라면 `deploy.sh`만으론 부족함** — 이 스크립트는 코드(백엔드/
프론트)만 갱신하고 설정 파일은 안 건드림. 그럴 때는 아래도 같이 실행:

```bash
sudo cp /opt/silga/deploy/nginx-silga.conf /etc/nginx/sites-available/silga
sudo cp /opt/silga/deploy/silga-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo nginx -t && sudo systemctl reload nginx
```

## 참고

- DB 파일(`backend/ppe.db`, SQLite)은 VM 로컬 디스크에만 있음 — VM 삭제하면
  데이터도 같이 날아감. 개인 도구라 백업 자동화는 하지 않음(필요하면 그때
  `scp`로 수동 백업)
- 로그 확인: `sudo journalctl -u silga-backend -f`
- 매너 크롤링 원칙(요청 간격 5~10초)은 배포 환경에서도 동일하게 적용됨 —
  VM 자체 성능과는 무관한 제약(CLAUDE.md 참조)
