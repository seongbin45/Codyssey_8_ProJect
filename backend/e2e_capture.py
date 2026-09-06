"""
프론트엔드(라이트/다크 재디자인)를 Playwright로 직접 조작해서 스크린샷 증거를 남기는 스크립트.
사전 조건: backend(127.0.0.1:8000), frontend static server(127.0.0.1:5500)가 떠 있어야 함.
"""
import time
from playwright.sync_api import sync_playwright

FRONTEND_URL = "http://127.0.0.1:5500/"
SHOTS_DIR = "../screenshots"


def shot(page, name):
    page.screenshot(path=f"{SHOTS_DIR}/{name}")
    print(f"saved: {name}")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 950})

        page.on("dialog", lambda d: d.accept())  # 삭제 확인(confirm) 자동 수락

        page.goto(FRONTEND_URL)
        page.wait_for_selector("#chat-messages")
        time.sleep(1.5)  # App.boot() 헬스체크 + 초기 데이터 로드 대기

        # 1) 채팅: 질문 + 데이터 요약 반영된 답변 + 주입된 컨텍스트 패널
        page.fill("#chat-input", "이번 데이터 요약이랑 최근 트렌드 좀 알려줘")
        page.click("#chat-form button[type=submit]")
        page.wait_for_selector(".msg--assistant .msg__bubble", timeout=30000)
        time.sleep(0.5)
        page.click("#ctx-toggle")
        # 질문+답변이 같이 보이도록 채팅 영역을 맨 위로 스크롤한 뒤 캡처
        page.eval_on_selector("#chat-messages", "el => el.scrollTop = 0")
        time.sleep(0.2)
        shot(page, "01_chat_summary_qna.png")

        # 2) 데이터 관리: 새 데이터 추가 (CRUD 중 1개 동작)
        # 실제 데이터(삼성전자 종가, 대략 4.8만~8.5만) 범위에 맞는 값을 써야 차트/요약 스케일이
        # 깨지지 않는다. 캡처 후에는 삭제까지 수행해 최종 데이터셋을 깨끗하게 되돌린다.
        page.click('[data-tab-btn="data"]')
        page.wait_for_selector("#data-table-body tr")
        page.fill("#data-date", "2026-09-07")
        page.fill("#data-value", "70000")
        page.fill("#data-memo", "playwright 증거용 테스트 입력")
        page.click("#data-submit-btn")
        page.wait_for_function(
            "() => document.querySelector('#data-table-body').innerText.includes('playwright 증거용 테스트 입력')"
        )
        time.sleep(0.3)
        shot(page, "02_data_management_add.png")

        # 캡처가 끝났으니 테스트로 추가한 행을 삭제해 데이터셋을 원상 복구 (삭제 CRUD도 함께 검증)
        test_row = page.locator("#data-table-body tr", has_text="playwright 증거용 테스트 입력")
        test_row.locator(".btn--danger").click()
        page.wait_for_function(
            "() => !document.querySelector('#data-table-body').innerText.includes('playwright 증거용 테스트 입력')"
        )

        # 3) 대화 기록: 목록
        page.click('[data-tab-btn="conversations"]')
        page.wait_for_selector(".conversation-item")
        shot(page, "03_conversations_list.png")

        # 4) 대화 불러오기 -> 채팅 화면 복원
        first_load_btn = page.locator(".conversation-item .btn--soft").first
        first_load_btn.click()
        page.wait_for_selector('[data-tab-panel="chat"]:not([hidden])')
        time.sleep(0.5)
        shot(page, "04_conversation_loaded_in_chat.png")

        # 5) 데이터 요약 + 차트 (총합/표준편차 포함 7카드 + 기간별 라인차트)
        page.click('[data-tab-btn="summary"]')
        page.wait_for_selector("#summary-cards .summary-card")
        time.sleep(0.3)
        shot(page, "05_data_summary.png")

        # 6) 다크 모드 (보너스: 라이트/다크 토글)
        page.click("#theme-btn")
        time.sleep(0.3)
        shot(page, "06_dark_mode.png")

        browser.close()


if __name__ == "__main__":
    run()
