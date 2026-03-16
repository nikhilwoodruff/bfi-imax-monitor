"""Scrape BFI IMAX seat availability for all upcoming screenings.

Auto-discovers all films and performances from the BFI IMAX calendar,
then scrapes seat availability for each. Results go to data/{performance_id}.csv.
Designed to run in GitHub Actions on a schedule.
"""

import asyncio
import csv
import json
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright, Page

load_dotenv()

BASE_URL = "https://whatson.bfi.org.uk/imax/Online"
DATA_DIR = Path("data")
SEARCH_ID = "49C49C83-6BA0-420C-A784-9B485E36E2E0"

STATUS_MAP = {
    "A": "available",
    "S": "sold",
    "U": "unavailable",
    "u": "unavailable",
    "s": "selected",
    "O": "other",
}

CSV_FIELDS = [
    "scraped_at",
    "row",
    "seat",
    "status",
    "is_wheelchair",
    "description",
]

# searchResults column indices (from searchHeaders in articleContext)
COL_ID = 0          # performance/article GUID
COL_NAME = 4        # film permalink slug
COL_TIME = 8        # screening time
COL_DATE = 9        # screening date
COL_MONTH = 10      # screening month
COL_YEAR = 11       # screening year


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


async def discover_performances(page: Page, days_ahead: int = 30) -> list[dict]:
    """Discover all upcoming screenings from the BFI IMAX calendar search."""
    today = datetime.now()
    end = today + timedelta(days=days_ahead)
    from_str = f"{today.year}-{today.month}-{today.day}"
    to_str = f"{end.year}-{end.month}-{end.day}"

    search_url = (
        f"{BASE_URL}/default.asp?"
        f"doWork%3A%3AWScontent%3A%3Asearch=1&"
        f"BOparam%3A%3AWScontent%3A%3Asearch%3A%3Aarticle_search_id={SEARCH_ID}&"
        f"BOset%3A%3AWScontent%3A%3ASearchCriteria%3A%3Asearch_from={from_str}&"
        f"BOset%3A%3AWScontent%3A%3ASearchCriteria%3A%3Asearch_to={to_str}"
    )
    print(f"Discovering screenings {from_str} to {to_str}...")
    await page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(5000)

    # Extract the embedded searchResults JS array from the page HTML
    html = await page.content()
    sr_match = re.search(
        r"searchResults\s*:\s*(\[.+?\])\s*,\s*searchResultsColumns",
        html,
        re.DOTALL,
    )
    if not sr_match:
        print("Could not find searchResults in page — trying JS eval fallback")
        # Try from JS scope
        data = await page.evaluate("""
            () => typeof articleContext !== 'undefined' ? articleContext.searchResults : null
        """)
        if not data:
            print("No searchResults found")
            return []
    else:
        data = json.loads(sr_match.group(1))

    # Also extract the film titles from the rendered page (Buy button aria-labels)
    labels = await page.evaluate("""
        () => [...document.querySelectorAll('a[aria-label]')]
            .filter(a => a.textContent.trim() === 'Buy')
            .map(a => a.getAttribute('aria-label'))
    """)

    performances = []
    for i, item in enumerate(data):
        perf_id = item[COL_ID]
        slug = item[COL_NAME]
        # Build a label from the Buy button aria-label if available
        label = labels[i] if i < len(labels) else slug
        # Clean up label: "Buy, Project Hail Mary, Saturday 21 March 2026 13:30" → drop "Buy, "
        if label and label.startswith("Buy, "):
            label = label[5:]

        performances.append({
            "performance_id": perf_id,
            "film_slug": slug,
            "label": label,
        })

    return performances


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
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

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

        # Auto-discover all upcoming screenings
        performances = await discover_performances(page)
        print(f"Found {len(performances)} screening(s)")

        if not performances:
            print("No screenings found — exiting")
            await browser.close()
            return

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
                try:
                    await page.screenshot(path=f"debug_{pid[:8]}.png")
                except Exception:
                    pass

        update_index(performances, now)
        await browser.close()

    print("Done")


if __name__ == "__main__":
    asyncio.run(main())
