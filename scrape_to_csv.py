"""Scrape BFI IMAX seat availability and append to CSV files.

Reads performances from config.json, scrapes each one, and writes
results to data/{performance_id}.csv. Designed to run in GitHub Actions
on a schedule.
"""

import asyncio
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright, Page

load_dotenv()

BASE_URL = "https://whatson.bfi.org.uk/imax/Online"
DATA_DIR = Path("data")
CONFIG_PATH = Path("config.json")

STATUS_MAP = {
    "A": "available",
    "S": "sold",
    "U": "unavailable",
    "u": "unavailable",
    "s": "selected",
}

CSV_FIELDS = [
    "scraped_at",
    "row",
    "seat",
    "status",
    "is_wheelchair",
    "description",
]


async def login(page: Page):
    email = os.getenv("BFI_EMAIL")
    password = os.getenv("BFI_PASSWORD")
    if not email or not password:
        print("No BFI credentials — continuing without login")
        return

    print(f"Logging in as {email}...")
    await page.goto(
        f"{BASE_URL}/maintainAccount.asp",
        wait_until="domcontentloaded",
        timeout=60000,
    )
    await page.wait_for_timeout(3000)

    try:
        inputs = page.locator("form input:visible")
        await inputs.nth(0).fill(email)
        await inputs.nth(1).fill(password)
        await page.click('button:has-text("Sign in"), input[value="Sign in"]', timeout=5000)
        await page.wait_for_timeout(5000)
        print("Login submitted")
    except Exception as e:
        print(f"Login failed: {e}")


async def scrape_performance(page: Page, performance_id: str) -> list[dict]:
    url = f"{BASE_URL}/mapSelect.asp?BOparam::WSmap::loadMap::performance_ids={performance_id}"
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    try:
        await page.wait_for_selector("svg circle[data-status]", timeout=30000)
    except Exception:
        await page.wait_for_timeout(10000)

    raw = await page.evaluate("""
        () => {
            const circles = document.querySelectorAll('svg circle[data-status]');
            return [...circles].map(c => ({
                status: c.getAttribute('data-status'),
                row: c.getAttribute('data-seat-row'),
                seat: parseInt(c.getAttribute('data-seat-seat')),
                desc: c.getAttribute('data-tsdesc') || '',
                message: c.getAttribute('data-tsmessage') || '',
            }));
        }
    """)
    return raw


def append_to_csv(performance_id: str, seats: list[dict], now: str):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = DATA_DIR / f"{performance_id}.csv"
    file_exists = csv_path.exists()

    with open(csv_path, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if not file_exists:
            writer.writeheader()

        for s in seats:
            if not s.get("row") or not s.get("seat"):
                continue
            status = STATUS_MAP.get(s["status"], s["status"])
            msg = s.get("message", "")
            writer.writerow({
                "scraped_at": now,
                "row": s["row"],
                "seat": s["seat"],
                "status": status,
                "is_wheelchair": "wheelchair" in msg.lower(),
                "description": s.get("desc", ""),
            })


def update_index(performances: list[dict], now: str):
    """Write/update data/index.json with metadata about tracked performances."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    index_path = DATA_DIR / "index.json"

    # Load existing index or start fresh
    if index_path.exists():
        index = json.loads(index_path.read_text())
    else:
        index = {}

    for perf in performances:
        pid = perf["performance_id"]
        if pid not in index:
            index[pid] = {
                "film_slug": perf["film_slug"],
                "label": perf.get("label", perf["film_slug"]),
                "first_scraped": now,
            }
        index[pid]["last_scraped"] = now

    index_path.write_text(json.dumps(index, indent=2) + "\n")


async def main():
    config = json.loads(CONFIG_PATH.read_text())
    performances = config["performances"]
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    print(f"Scraping {len(performances)} performance(s) at {now}")

    # Use headed mode with xvfb in CI — Cloudflare blocks headless Chrome
    is_ci = os.getenv("CI") == "true"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => false });"
        )
        page = await context.new_page()

        await login(page)

        for perf in performances:
            pid = perf["performance_id"]
            label = perf.get("label", perf["film_slug"])
            print(f"  Scraping {label} ({pid[:8]})...")

            try:
                seats = await scrape_performance(page, pid)

                if not seats:
                    print("    No seats found — saving debug screenshot")
                    await page.screenshot(path=f"debug_{pid[:8]}.png")

                append_to_csv(pid, seats, now)

                by_status = {}
                for s in seats:
                    st = STATUS_MAP.get(s["status"], s["status"])
                    by_status[st] = by_status.get(st, 0) + 1
                print(f"    {len(seats)} seats: {by_status}")
            except Exception as e:
                print(f"    Error: {e}")
                await page.screenshot(path=f"debug_{pid[:8]}.png")

        update_index(performances, now)
        await browser.close()

    print("Done")


if __name__ == "__main__":
    asyncio.run(main())
