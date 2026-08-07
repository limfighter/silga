# 실가

다나와 실시간 최저가 기반 PC 부품 가격 추적 + 조립PC 적정가 판정 엔진.
개인용 웹앱이자, AI 라우터(Claude 등)가 tool처럼 호출할 수 있는 API 서버.

세부 설계/이력은 프로젝트 인수인계 문서 3파일 참조:
- `실가_인수인계.md` — 현재 상태, 수정 예정 사항, 미결사항 (세션 시작 시 필수)
- `실가_REFERENCE.md` — 규칙/구조/엔드포인트 계약 (자주 안 바뀜)
- `실가_HISTORY.md` — 변경 이력 (append-only)

## 로컬 실행

### 백엔드 (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
`http://localhost:8000/docs`에서 API 문서(Swagger UI) 확인 가능.

### 프론트엔드 (Vite + React + TS)
```bash
cd frontend
npm install
npm run dev
```
`http://localhost:5173`. 기본적으로 백엔드를 `http://localhost:8000`으로 호출함.
다른 주소(다른 포트, 원격 백엔드 등)를 쓰려면 `frontend/.env.example`을
`frontend/.env`로 복사한 뒤 `VITE_API_BASE` 값을 수정 (`frontend/src/lib/api.ts`
참조, `.env`는 `.gitignore`에 포함돼 커밋되지 않음).

### E2E 스모크 테스트 (선택)
```bash
pip install playwright && playwright install chromium
# 백엔드 + 프론트 둘 다 띄운 상태에서
python3 scripts/e2e_smoke_test.py
```

## 배포

GCP e2-micro 무료 티어 VM에 프론트+백엔드를 함께 올리는 방법은
`deploy/README.md` 참조 (systemd 서비스 파일, nginx 설정, 업데이트
스크립트 포함).

## 현재 구현 상태 (요약)

| 영역 | 상태 |
|---|---|
| 백엔드 엔드포인트 | `/search`, `/product/{code}`, `/product/{code}/history`, `/estimate`, `/product/{code}/compare`, `/build/compare`, `/builds`(CRUD), `/favorites`(CRUD) — 전부 라이브 검증 완료 |
| DB | SQLite(WAL), `products`/`builds`/`build_items`/`favorites` 4테이블 |
| 프론트 | 사이드바 7탭(홈/검색/빌드/즐겨찾기/최근기록/통계/설정) 전부 실데이터 연동 완료 |
| verdict 판정 기준가 | 이동평균(7/14/30일 선택, 기본 14일) 기반, 즉시가는 별도 유지 |

자세한 건 `실가_인수인계.md` 참조. 이 프로젝트는 git 리포(`limfighter/silga`)로
관리되므로, 컨테이너 세션이 리셋돼도 커밋+push만 해두면 다음 세션에서 이어받을
수 있음(zip 업로드 불필요).
