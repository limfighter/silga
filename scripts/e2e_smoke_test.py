"""
E2E 스모크 테스트 — Playwright로 실제 브라우저에서
검색->스펙필터->빌드생성->상세->목록->홈->통계->최근기록->즐겨찾기 흐름 검증.

이 리포의 유일한 테스트. 타입체크(npm run typecheck)로는 절대 못 잡는 것,
즉 "다나와 DOM이 바뀌어서 화면에 0건이 뜨는" 류의 조용한 고장을 잡는 게
목적이라 실제 스크래핑을 그대로 태운다(그래서 느림 — 전체 2~4분).

사전조건:
  pip install playwright && playwright install chromium
  백엔드(uvicorn, :8000)와 프론트(vite dev, :5173)가 모두 떠 있어야 함

실행:
  python3 scripts/e2e_smoke_test.py

환경변수(전부 선택):
  E2E_BASE       프론트 주소 (기본 http://localhost:5173)
  E2E_API        백엔드 주소 (기본 http://localhost:8000) — 뒷정리에만 씀
  E2E_SHOT_DIR   스크린샷 저장 폴더 (기본 ./e2e-shots, 없으면 생성)
  E2E_CHROMIUM   chromium 실행 파일 경로. playwright가 받아둔 브라우저와
                 버전이 안 맞는 환경에서만 지정하면 됨
  E2E_KEEP_BUILD 1이면 테스트가 만든 빌드를 지우지 않고 남김

주의:
  - 스텝 순서를 바꾸지 말 것. 최근기록/즐겨찾기는 localStorage와 앞 스텝의
    조회 결과에 의존함(통계 탭에서 부품을 봐야 최근기록에 남음).
  - 셀렉터는 화면 문구가 아니라 구조 클래스(.search-result-row, .bc-row 등)를
    쓴다. 2026-08-05 디자인 개편 때 placeholder 문자열로 잡아둔 셀렉터가
    전부 깨져서 테스트가 통째로 썩었던 전례가 있음(2026-08-23 복구).
"""

import os
import pathlib
import re
import sys
import time

from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:5173")
API = os.environ.get("E2E_API", "http://localhost:8000")
SHOT_DIR = pathlib.Path(os.environ.get("E2E_SHOT_DIR", "e2e-shots"))
CHROMIUM = os.environ.get("E2E_CHROMIUM")
KEEP_BUILD = os.environ.get("E2E_KEEP_BUILD") == "1"

BUILD_NAME = "E2E 테스트 빌드"
SHOT_DIR.mkdir(parents=True, exist_ok=True)

steps = []


def ok(label, detail=""):
    steps.append((True, label))
    print(f"  OK  {label}" + (f" — {detail}" if detail else ""))


def shot(page, name):
    page.screenshot(path=str(SHOT_DIR / f"e2e_{name}.png"), full_page=True)


def expect(cond, label, detail=""):
    if not cond:
        steps.append((False, label))
        raise AssertionError(f"{label} 실패 — {detail}")
    ok(label, detail)


def pick_from_panel(page, category, keyword):
    """빌드 생성 화면의 마스터-디테일 패널에서 부품 하나 고르기.

    2026-08-06 개편으로 카테고리마다 인라인 .part-row가 반복되던 구조가
    "왼쪽에서 카테고리 클릭 → 오른쪽 패널에서 검색" 으로 바뀌었음.
    """
    page.locator(".bc-row").filter(has_text=category).first.click()
    page.wait_for_selector(".bc-search-input", timeout=15000)
    page.fill(".bc-search-input", keyword)
    # 패널은 검색어 없이도 카테고리 기본 목록을 이미 띄워두므로, 그냥
    # .bc-result-row를 기다리면 필터 전 목록을 잡는다 — 키워드가 포함된
    # 행이 나타날 때까지 기다려야 함(입력 디바운스 500ms + 스크래핑)
    row = page.locator(".bc-result-row").filter(has_text=keyword).first
    row.wait_for(timeout=30000)
    row.click()
    filled = page.locator(".bc-row.filled").filter(has_text=category)
    filled.first.wait_for(timeout=10000)
    return filled.count()


def run(page, created):
    """created 리스트에는 만들자마자 빌드 id를 넣는다 — 뒤 스텝에서 실패해도
    뒷정리가 돌게 하려는 것(반환값으로만 넘기면 실패 시 빌드가 DB에 남는다)."""
    # ---- 1) 검색 탭 ----
    page.goto(f"{BASE}/search")
    page.wait_for_selector(".search-box input", timeout=20000)
    page.fill(".search-box input", "9800X3D")
    page.locator(".search-box button").click()
    page.wait_for_selector(".search-result-row", timeout=40000)
    n = page.locator(".search-result-row").count()
    shot(page, "1_search")
    expect(n > 0, "검색 결과 표시", f"{n}건")

    # ---- 2) 스펙 필터 동시 적용(backend v0.13~v0.16) ----
    page.locator(".category-tab").filter(has_text="GPU").first.click()
    page.wait_for_selector(".search-spec-filters select", timeout=30000)
    sel = page.locator(".search-spec-filters select")
    expect(sel.count() == 3, "GPU 스펙 select 3개", f"{sel.count()}개")
    sel.nth(0).select_option("NVIDIA")
    sel.nth(1).select_option("16")
    page.wait_for_selector(".answer .because .cond", timeout=40000)
    values = [sel.nth(i).input_value() for i in range(sel.count())]
    chips = page.locator(".answer .because .cond").count()
    shot(page, "2_spec_filters")
    expect(
        values[0] == "NVIDIA" and values[1] == "16" and chips == 2,
        "스펙 필터 2개 동시 유지",
        f"값={values} 조건칩={chips}",
    )
    page.locator(".search-spec-filters .spec-clear").click()
    page.wait_for_selector(".answer .because .cond", state="detached", timeout=30000)
    expect(
        all(sel.nth(i).input_value() == "" for i in range(sel.count())),
        "조건 지우기로 전체 해제",
    )

    # ---- 3) 빌드 생성 ----
    page.goto(f"{BASE}/build/new")
    page.wait_for_selector(".bc-row", timeout=20000)
    page.locator(".bc-left input").first.fill(BUILD_NAME)
    cpu = pick_from_panel(page, "CPU", "9800X3D")
    expect(cpu == 1, "CPU 부품 선택")
    gpu = pick_from_panel(page, "GPU", "RTX 5070 Ti")
    expect(gpu == 1, "GPU 부품 선택")

    page.locator(".bc-left input").nth(1).fill("2500000")
    shot(page, "3_build_form")
    page.locator(".form-actions .btn-primary").click()
    page.wait_for_url(re.compile(r"/build/\d+$"), timeout=60000)
    build_id = int(page.url.rsplit("/", 1)[-1])
    created.append(build_id)

    # ---- 4) 빌드 상세 ----
    page.wait_for_selector(".gauge-card", timeout=40000)
    page.wait_for_selector(".spec-row", timeout=20000)
    time.sleep(1.5)  # 게이지 니들 트랜지션 대기
    rows = page.locator(".spec-row").count()
    shot(page, "4_build_detail")
    expect(rows >= 2, "빌드 상세 부품 행", f"{rows}행, build_id={build_id}")

    # ---- 5) 빌드 목록 ----
    page.goto(f"{BASE}/build")
    # "새 빌드 만들기"(.build-card.new)는 목록이 로딩 중이어도 항상 떠 있으므로
    # 그냥 .build-card를 기다리면 조회가 끝나기 전에 통과해버림 — 실제 빌드
    # 카드가 나타날 때까지 기다려야 한다
    page.wait_for_selector(".build-card:not(.new)", timeout=60000)
    cards = page.locator(".build-card:not(.new)").count()
    shot(page, "5_build_list")
    expect(cards > 0, "빌드 목록 카드", f"{cards}개")

    # ---- 6) 홈 (집계 + 최근 빌드 카드) ----
    page.goto(f"{BASE}/")
    page.wait_for_selector(".build-card", timeout=60000)
    home_cards = page.locator(".build-card").count()
    shot(page, "6_home")
    expect(home_cards > 0, "홈 최근 빌드 카드", f"{home_cards}개")
    page.locator(".build-card").first.click()
    page.wait_for_url(re.compile(r"/build/\d+$"), timeout=20000)
    page.wait_for_selector(".gauge-card", timeout=40000)
    ok("홈 카드 → 빌드 상세 이동", page.url)

    # ---- 7) 통계 (부품 조회 → 가격 히스토리 차트) ----
    #      최근기록 스텝의 전제 조건이므로 순서를 바꾸지 말 것
    page.goto(f"{BASE}/stats")
    page.wait_for_selector(".stats-picker .part-input", timeout=20000)
    page.fill(".stats-picker .part-input", "9800X3D")
    page.wait_for_selector(".autocomplete-item .nm", timeout=40000)
    page.locator(".autocomplete-item").filter(has=page.locator(".nm")).first.click()
    page.wait_for_selector(".chart-card", timeout=40000)
    tabs = page.locator(".month-tab").count()
    shot(page, "7_stats")
    expect(tabs > 0, "통계 차트 + 월 탭", f"{tabs}개 탭")
    page.locator(".month-tab").filter(has_text="12개월").click()
    page.wait_for_selector(".chart-card", timeout=40000)
    expect(page.locator(".chart-card").count() > 0, "12개월 탭 전환 후 차트 유지")

    # ---- 8) 최근기록 (통계 조회가 계측됐는지) ----
    page.goto(f"{BASE}/history")
    page.wait_for_selector(".recent-row", timeout=20000)
    hist = page.locator(".recent-row").count()
    shot(page, "8_history")
    expect(hist > 0, "최근기록 적재", f"{hist}행")
    page.locator(".recent-row").first.click()
    page.wait_for_url("**/stats", timeout=20000)
    page.wait_for_selector(".chart-card", timeout=40000)
    ok("최근기록 → 통계 탭 이동")

    # ---- 9) 즐겨찾기 (추가 → 목록 → 제거) ----
    page.goto(f"{BASE}/favorites")
    page.wait_for_selector(".stats-picker .part-input", timeout=20000)
    page.fill(".stats-picker .part-input", "RTX 5070 Ti")
    page.wait_for_selector(".autocomplete-item .nm", timeout=40000)
    page.locator(".autocomplete-item").filter(has=page.locator(".nm")).first.click()
    page.wait_for_selector(".recent-list .recent-row", timeout=40000)
    favs = page.locator(".recent-list .recent-row").count()
    shot(page, "9_favorites_added")
    expect(favs > 0, "즐겨찾기 추가", f"{favs}행")
    page.locator(".recent-row .remove").first.click()
    page.wait_for_selector(".empty-state", timeout=30000)
    shot(page, "10_favorites_removed")
    expect(page.locator(".empty-state").count() > 0, "즐겨찾기 제거 후 빈 상태")


def main():
    errors = []
    created = []
    crashed = False
    with sync_playwright() as p:
        launch = {"executable_path": CHROMIUM} if CHROMIUM else {}
        browser = p.chromium.launch(**launch)
        page = browser.new_page(viewport={"width": 1280, "height": 950})
        # 콘솔 예외는 화면이 멀쩡해 보여도 잡아야 하므로 따로 수집
        page.on("pageerror", lambda e: errors.append(str(e)))
        try:
            run(page, created)
        except Exception as exc:  # 실패 지점을 스크린샷으로 남기고 그대로 실패
            crashed = True
            shot(page, "FAIL")
            print(f"\n  XX  실패: {exc}")
        finally:
            # 테스트가 만든 빌드는 지운다 — 안 지우면 실행할 때마다 쌓여서
            # 다음 실행의 홈/목록이 계속 느려짐(홈은 저장된 빌드를 전부 조회함)
            if not KEEP_BUILD:
                for bid in created:
                    resp = page.request.delete(f"{API}/builds/{bid}")
                    print(f"\n뒷정리: 빌드 {bid} 삭제 → {resp.status}")
            browser.close()

    passed = sum(1 for good, _ in steps if good)
    failed = [label for good, label in steps if not good]
    print(f"\n검증 {passed}건 통과" + (f", {len(failed)}건 실패: {failed}" if failed else ""))
    if errors:
        print(f"pageerror {len(errors)}건: {errors[:3]}")
    print(f"스크린샷: {SHOT_DIR.resolve()}")

    if failed or errors or crashed or not created:
        print("E2E 테스트 실패")
        return 1
    print("E2E 테스트 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
