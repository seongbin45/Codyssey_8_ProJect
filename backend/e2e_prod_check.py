import time
from playwright.sync_api import sync_playwright

FRONTEND_URL = "https://codyssey-8-pro-ject.vercel.app/"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("requestfailed", lambda req: errors.append(f"requestfailed: {req.url} {req.failure}"))

    page.goto(FRONTEND_URL)
    page.wait_for_selector("#chat-messages")
    time.sleep(1)

    page.fill("#chat-input", "production check: what's the trend?")
    page.click("#chat-form button[type=submit]")
    page.wait_for_selector(".msg--assistant .msg__bubble", timeout=30000)
    time.sleep(0.5)

    reply_text = page.inner_text("#chat-messages")
    print("=== chat reply present ===")
    print("PASS" if "production check" in reply_text else "FAIL")

    page.click('[data-tab-btn="data"]')
    page.wait_for_selector("#data-table-body tr")
    row_count = page.locator("#data-table-body tr").count()
    print("=== data rows loaded ===")
    print(f"row_count={row_count}")

    page.click('[data-tab-btn="summary"]')
    page.wait_for_selector("#summary-cards .summary-card")
    summary_text = page.inner_text("#summary-cards")
    print("=== summary cards ===")
    print(summary_text[:200])

    print("=== console/network errors ===")
    print(errors if errors else "none")

    browser.close()
