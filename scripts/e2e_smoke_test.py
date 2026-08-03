"""
E2E 스모크 테스트 — Playwright로 실제 브라우저에서 검색->빌드생성->상세->목록 흐름 검증.

사전조건:
  pip install playwright && playwright install chromium
  백엔드(uvicorn, :8000)와 프론트(vite dev, :5173)가 모두 떠 있어야 함

실행:
  python3 scripts/e2e_smoke_test.py
  (스크린샷은 /home/claude/e2e_*.png 등 실행 위치 기준 상대경로에 저장됨 — 필요시 경로 수정)
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

    browser.close()

print("E2E 테스트 완료")
