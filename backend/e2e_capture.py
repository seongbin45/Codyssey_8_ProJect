"""
Playwright로 프론트엔드를 직접 조작해서 스크린샷 증거를 남기는 1회성 스크립트.
사전 조건: backend(127.0.0.1:8000), frontend static server(127.0.0.1:5500)가 떠 있어야 함.
"""
import os
import time
from playwright.sync_api import sync_playwright

FRONTEND_URL = "http://127.0.0.1:5500/"
SHOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "screenshots")
os.makedirs(SHOTS_DIR, exist_ok=True)


def shot(page, name):
    path = os.path.join(SHOTS_DIR, name)
    page.screenshot(path=path)
    print(f"saved: {name}")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        page.goto(FRONTEND_URL)
        page.wait_for_selector("#chat-messages")
        time.sleep(0.5)

        # 1) 채팅: 질문 + 데이터 요약 반영된 답변
        page.fill("#chat-input", "이번 데이터 요약이랑 최근 트렌드 좀 알려줘")
        page.click("#chat-form button[type=submit]")
        # AI 응답 버블이 로딩 버블을 대체할 때까지 대기
        page.wait_for_selector(".chat-bubble--assistant:not(.chat-bubble--loading)", timeout=30000)
        time.sleep(0.5)
        # 질문+답변이 같이 보이도록 채팅 영역을 맨 위로 스크롤한 뒤 캡처
        page.eval_on_selector("#chat-messages", "el => el.scrollTop = 0")
        time.sleep(0.2)
        shot(page, "01_chat_summary_qna.png")

        # 2) 데이터 관리: 새 데이터 추가 (CRUD 중 1개 동작)
        page.click('[data-tab-btn="data"]')
        page.wait_for_selector("#data-table-body tr")
        page.fill("#data-date", "2026-09-05")
        page.fill("#data-value", "9999999")
        page.fill("#data-memo", "playwright 증거용 테스트 입력")
        page.click("#data-submit-btn")
        page.wait_for_function(
            """() => document.querySelector('#data-table-body').innerText.includes('playwright 증거용 테스트 입력')"""
        )
        time.sleep(0.3)
        shot(page, "02_data_management_add.png")

        # 3) 대화 기록: 목록 -> 불러오기
        page.click('[data-tab-btn="conversations"]')
        page.wait_for_selector(".conversation-item")
        shot(page, "03_conversations_list.png")

        first_load_btn = page.locator(".conversation-item .btn--ghost").first
        first_load_btn.click()
        # 불러오기 클릭 시 chat 탭으로 자동 전환됨
        page.wait_for_selector('[data-tab-panel="chat"]:not([hidden])')
        time.sleep(0.5)
        shot(page, "04_conversation_loaded_in_chat.png")

        # 4) 데이터 요약 탭
        page.click('[data-tab-btn="summary"]')
        page.wait_for_selector("#summary-cards .summary-card")
        time.sleep(0.3)
        shot(page, "05_data_summary.png")

        browser.close()


if __name__ == "__main__":
    run()
