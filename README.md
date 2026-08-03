# PPE (임시 코드네임) — 실가

다나와 실시간 최저가 기반 PC 부품 가격 추적 + 조립PC 적정가 판정 엔진.
개인용 웹앱이자, AI 라우터(Claude 등)가 tool처럼 호출할 수 있는 API 서버.

세부 설계/이력은 프로젝트 인수인계 문서 3파일 참조:
- `PPE_인수인계.md` — 현재 상태, 수정 예정 사항, 미결사항 (세션 시작 시 필수)
- `PPE_REFERENCE.md` — 규칙/구조/엔드포인트 계약 (자주 안 바뀜)
- `PPE_HISTORY.md` — 변경 이력 (append-only)

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
`http://localhost:5173`. 기본적으로 백엔드를 `http://localhost:8000`으로 호출함
(다른 주소를 쓰려면 `frontend/.env`에 `VITE_API_BASE=http://...` 설정).

### E2E 스모크 테스트 (선택)
```bash
pip install playwright && playwright install chromium
# 백엔드 + 프론트 둘 다 띄운 상태에서
python3 scripts/e2e_smoke_test.py
```

## 현재 구현 상태 (요약)

| 영역 | 상태 |
|---|---|
| 백엔드 엔드포인트 | `/search`, `/product/{code}`, `/product/{code}/history`, `/estimate`, `/product/{code}/compare`, `/build/compare`, `/builds`(CRUD) — 전부 라이브 검증 완료 |
| DB | SQLite(WAL), `products`/`builds`/`build_items` 3테이블 |
| 프론트 | 검색 탭, 빌드 목록/생성/상세 실데이터 연동 완료. 홈/즐겨찾기/최근기록/통계/설정은 "준비 중" 플레이스홀더 |
| 미구현 필드 | `/product/{code}` 응답의 `category`, `cash_price` (스크래퍼 미지원) |

자세한 건 `PPE_인수인계.md` 참조. **주의: 이 zip 바깥의 실행 환경(컨테이너)은 세션마다 리셋되므로, 작업 이어가려면 매번 이 리포를 다시 업로드해야 함.**
