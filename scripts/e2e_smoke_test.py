"""
E2E 스모크 테스트 — Playwright로 실제 브라우저에서
검색->빌드생성->상세->목록->홈->통계->최근기록->즐겨찾기 흐름 검증.

사전조건:
  pip install playwright && playwright install chromium
  백엔드(uvicorn, :8000)와 프론트(vite dev, :5173)가 모두 떠 있어야 함

실행:
  python3 scripts/e2e_smoke_test.py
  (스크린샷은 /home/claude/e2e_*.png 등 실행 위치 기준 상대경로에 저장됨 — 필요시 경로 수정)

참고: 홈/통계/최근기록/즐겨찾기 스텝은 2026-08-04 세션에 추가됨. localStorage
기반(최근기록/ma_window)이라 이전 스텝(통계 탭 부품 조회)이 최근기록 스텝의
전제 조건 — 순서를 바꾸지 말 것.
"""

import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # ---- 1) 검색 탭 ----
    page.goto(f"{BASE}/search")
    page.wait_for_selector("input[placeholder='예: RTX 5070 Ti 16GB']")
    page.fill("input[placeholder='예: RTX 5070 Ti 16GB']", "9800X3D")
    page.click("button:has-text('검색')")
    page.wait_for_selector(".search-result-row", timeout=15000)
    time.sleep(0.5)
    page.screenshot(path="/home/claude/e2e_1_search.png", full_page=True)
    print("1) 검색 결과 행 개수:", page.locator(".search-result-row").count())

    # ---- 2) 빌드 생성 ----
    page.goto(f"{BASE}/build/new")
    page.wait_for_selector("input[placeholder='예: 5070 Ti 조합']")
    page.fill("input[placeholder='예: 5070 Ti 조합']", "E2E 테스트 빌드")

    # CPU 선택
    part_rows = page.locator(".part-row")
    cpu_row = part_rows.filter(has_text="CPU")
    cpu_row.locator(".part-input").click()
    cpu_row.locator(".part-input").fill("9800X3D")
    page.wait_for_selector(".autocomplete-item .nm", timeout=10000)
    print("DEBUG CPU 자동완성 실제결과 개수:", page.locator(".autocomplete-item .nm").count())
    item = page.locator(".autocomplete-item").filter(has=page.locator(".nm")).first
    item.click()
    time.sleep(0.3)
    print("DEBUG CPU part-selected 존재:", cpu_row.locator(".part-selected").count())
    page.screenshot(path="/home/claude/e2e_debug_cpu.png", full_page=True)

    # GPU 선택 (재고 있는 것으로 확인된 검색어)
    gpu_row = part_rows.filter(has_text="GPU")
    gpu_row.locator(".part-input").click()
    gpu_row.locator(".part-input").fill("PALIT RTX 5070 Ti")
    page.wait_for_selector(".autocomplete-item .nm", timeout=10000)
    print("DEBUG GPU 자동완성 실제결과 개수:", page.locator(".autocomplete-item .nm").count())
    gpu_item = page.locator(".autocomplete-item").filter(has=page.locator(".nm")).first
    gpu_item.click()
    time.sleep(0.3)
    print("DEBUG GPU part-selected 존재:", gpu_row.locator(".part-selected").count())
    page.screenshot(path="/home/claude/e2e_debug_gpu.png", full_page=True)

    page.fill("input[placeholder='예: 3,464,000']", "2500000")
    page.screenshot(path="/home/claude/e2e_2_build_form.png", full_page=True)

    page.click("button:has-text('분석하기')")
    page.wait_for_url("**/build/*", timeout=20000)
    page.wait_for_selector(".gauge-card", timeout=15000)
    time.sleep(1.5)  # 게이지 니들 트랜지션 대기
    page.screenshot(path="/home/claude/e2e_3_build_detail.png", full_page=True)
    print("2) 빌드 상세 URL:", page.url)
    print("3) breakdown 행 개수:", page.locator(".b-row").count())

    # ---- 3) 빌드 목록 ----
    page.goto(f"{BASE}/build")
    page.wait_for_selector(".build-card", timeout=10000)
    time.sleep(0.5)
    page.screenshot(path="/home/claude/e2e_4_build_list.png", full_page=True)
    print("4) 빌드 카드 개수:", page.locator(".build-card").count())

    # ---- 4) 홈 탭 (최근 빌드 대시보드) ----
    page.goto(f"{BASE}/")
    page.wait_for_selector(".build-card", timeout=10000)
    time.sleep(0.5)
    page.screenshot(path="/home/claude/e2e_5_home.png", full_page=True)
    print("5) 홈 최근빌드 카드 개수:", page.locator(".build-card").count())
    page.locator(".build-card").first.click()
    page.wait_for_url("**/build/*", timeout=10000)
    page.wait_for_selector(".gauge-card", timeout=15000)
    print("6) 홈 카드 클릭 -> 빌드 상세 이동 URL:", page.url)

    # ---- 5) 통계 탭 (부품 검색 -> 가격 히스토리 차트) ----
    page.goto(f"{BASE}/stats")
    stats_input = page.locator(".stats-picker .part-input")
    stats_input.click()
    stats_input.fill("9800X3D")
    page.wait_for_selector(".autocomplete-item .nm", timeout=10000)
    page.locator(".autocomplete-item").filter(has=page.locator(".nm")).first.click()
    page.wait_for_selector(".chart-card", timeout=15000)
    time.sleep(0.3)
    page.screenshot(path="/home/claude/e2e_6_stats.png", full_page=True)
    print("7) 통계 탭 차트 렌더링 확인, 월 탭 개수:", page.locator(".month-tab").count())
    page.locator(".month-tab").filter(has_text="12개월").click()
    page.wait_for_selector(".chart-card", timeout=15000)
    time.sleep(0.3)
    print("8) 12개월 탭 전환 후 차트 유지 확인:", page.locator(".chart-card").count())

    # ---- 6) 최근기록 탭 (위 통계 탭 조회가 계측됐는지 확인) ----
    page.goto(f"{BASE}/history")
    page.wait_for_selector(".recent-row", timeout=10000)
    time.sleep(0.3)
    page.screenshot(path="/home/claude/e2e_7_history.png", full_page=True)
    print("9) 최근기록 행 개수:", page.locator(".recent-row").count())
    page.locator(".recent-row").first.click()
    page.wait_for_url("**/stats", timeout=10000)
    page.wait_for_selector(".chart-card", timeout=15000)
    print("10) 최근기록 클릭 -> 통계 탭 바로 로드 확인:", page.url)

    # ---- 7) 즐겨찾기 탭 (추가 -> 목록 표시 -> 제거) ----
    page.goto(f"{BASE}/favorites")
    fav_input = page.locator(".stats-picker .part-input")
    fav_input.click()
    fav_input.fill("PALIT RTX 5070 Ti")
    page.wait_for_selector(".autocomplete-item .nm", timeout=10000)
    page.locator(".autocomplete-item").filter(has=page.locator(".nm")).first.click()
    page.wait_for_selector(".recent-list .recent-row", timeout=10000)
    time.sleep(0.3)
    page.screenshot(path="/home/claude/e2e_8_favorites_added.png", full_page=True)
    print("11) 즐겨찾기 추가 후 목록 행 개수:", page.locator(".recent-list .recent-row").count())
    page.locator(".recent-row .remove").first.click()
    page.wait_for_selector(".empty-state", timeout=10000)
    time.sleep(0.3)
    page.screenshot(path="/home/claude/e2e_9_favorites_removed.png", full_page=True)
    print("12) 즐겨찾기 제거 후 빈 상태 확인:", page.locator(".empty-state").count())

    browser.close()

print("E2E 테스트 완료")
