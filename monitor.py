"""BFI IMAX seat availability monitor.

Polls the BFI IMAX booking site for a given film/screening and alerts
when prime seats (centre, further back) become available.
"""

import asyncio
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime

from dotenv import load_dotenv
from playwright.async_api import async_playwright, Page
from pydantic import BaseModel
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

load_dotenv()
console = Console()

BASE_URL = "https://whatson.bfi.org.uk/imax/Online"

# BFI seat map status codes (from data-status attribute on SVG circles):
#   A → available
#   S → sold
#   U → unavailable/blocked
#   s → selected by current session

STATUS_MAP = {
    "A": "available",
    "S": "sold",
    "U": "unavailable",
    "u": "unavailable",
    "s": "selected",
}


@dataclass
class Seat:
    row: str
    number: int
    status: str
    description: str = ""
    message: str = ""
    is_wheelchair: bool = False
    score: float = 0.0


class MonitorConfig(BaseModel):
    film_slug: str
    poll_interval_seconds: int = 60
    min_score: float = 0.0
    headless: bool = True
    performance_id: str | None = None
    top_n: int = 10


def macos_notify(title: str, message: str):
    """Send a macOS desktop notification with sound."""
    subprocess.run(
        [
            "osascript",
            "-e",
            f'display notification "{message}" with title "{title}" sound name "Glass"',
        ],
        capture_output=True,
    )


def score_seat(seat: Seat, total_rows: int, seats_in_row: int) -> float:
    """Score a seat: higher = better. Prefers centre + further back.

    Wheelchair-only spaces get a penalty so they don't dominate the list
    unless specifically wanted.
    """
    row_idx = ord(seat.row.upper()) - ord("A")
    row_score = row_idx / max(total_rows - 1, 1)

    centre = (seats_in_row + 1) / 2
    distance_from_centre = abs(seat.number - centre)
    centre_score = 1.0 - (distance_from_centre / max(centre, 1))

    score = 0.6 * row_score + 0.4 * centre_score

    if seat.is_wheelchair:
        score *= 0.1  # heavy penalty — still shows up, just ranked low

    return round(score, 3)


async def login(page: Page):
    """Log in to BFI with credentials from .env."""
    email = os.getenv("BFI_EMAIL")
    password = os.getenv("BFI_PASSWORD")
    if not email or not password:
        console.print("[yellow]No BFI credentials in .env — continuing without login[/yellow]")
        return

    console.print(f"[dim]Logging in as {email}...[/dim]")

    # Navigate to the account page (the "Sign in" link from the BFI nav)
    account_url = f"{BASE_URL}/maintainAccount.asp"
    await page.goto(account_url, wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(3000)

    try:
        # The BFI login form — labels say "Email address" and "Password"
        # The inputs are plain text/password fields without helpful name attrs,
        # so target by field order or label association
        inputs = page.locator("form input:visible")
        input_count = await inputs.count()

        if input_count >= 2:
            await inputs.nth(0).fill(email)
            await inputs.nth(1).fill(password)
        else:
            # Fallback: try by type
            await page.fill('input[type="text"]:visible', email, timeout=5000)
            await page.fill('input[type="password"]:visible', password, timeout=5000)

        # Click "Sign in" button
        await page.click('button:has-text("Sign in"), input[value="Sign in"]', timeout=5000)
        await page.wait_for_timeout(5000)

        page_text = await page.inner_text("body")
        if "sign out" in page_text.lower() or "log out" in page_text.lower() or "welcome" in page_text.lower():
            console.print("[green]Logged in successfully[/green]")
        else:
            console.print("[yellow]Login submitted — couldn't confirm success[/yellow]")
            await page.screenshot(path="debug_login.png")
    except Exception as e:
        console.print(f"[yellow]Login failed: {e}[/yellow]")
        await page.screenshot(path="debug_login.png")
        console.print("[dim]Saved debug_login.png — continuing without login[/dim]")


async def get_screenings(page: Page, film_slug: str) -> list[dict]:
    """Navigate to the film page and extract screening performance IDs."""
    url = f"{BASE_URL}/default.asp?BOparam::WScontent::loadArticle::permalink={film_slug}"
    console.print(f"[dim]Navigating to film page...[/dim]")
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(5000)

    screenings = await page.evaluate(r"""
        () => {
            const results = [];
            const guidRe = /[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/;

            // Check links, buttons, onclick handlers
            for (const el of document.querySelectorAll('a, button, input[type="submit"]')) {
                const href = el.href || el.getAttribute('onclick') || el.getAttribute('formaction') || '';
                const text = el.textContent.trim();
                const match = href.match(guidRe);
                if (match) {
                    results.push({ text: text.slice(0, 80), href: href.slice(0, 200), performanceId: match[0] });
                }
            }
            // Check hidden inputs (forms often carry the performance ID)
            for (const input of document.querySelectorAll('input[type="hidden"]')) {
                const match = (input.value || '').match(guidRe);
                if (match) {
                    results.push({ text: input.name, href: '', performanceId: match[0] });
                }
            }
            return results;
        }
    """)
    return screenings


async def load_seat_map(page: Page, performance_id: str) -> list[Seat]:
    """Load the seat map for a given screening and parse all seats."""
    console.print(f"[dim]Loading seat map for {performance_id[:8]}...[/dim]")

    url = f"{BASE_URL}/mapSelect.asp?BOparam::WSmap::loadMap::performance_ids={performance_id}"
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    # Wait for SVG seat circles to appear
    try:
        await page.wait_for_selector("svg circle[data-status]", timeout=30000)
    except Exception:
        console.print("[yellow]Seat circles slow to appear, waiting more...[/yellow]")
        await page.wait_for_timeout(10000)

    raw_seats = await page.evaluate("""
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

    seats = []
    for s in raw_seats:
        if s["row"] and s["seat"]:
            msg = s.get("message", "")
            seats.append(Seat(
                row=s["row"],
                number=s["seat"],
                status=STATUS_MAP.get(s["status"], s["status"]),
                description=s["desc"],
                message=msg,
                is_wheelchair="wheelchair" in msg.lower(),
            ))

    return seats


def display_seats(seats: list[Seat], top_n: int = 10) -> list[Seat]:
    """Display seat availability summary and ranked available seats."""
    by_status: dict[str, int] = {}
    for s in seats:
        by_status[s.status] = by_status.get(s.status, 0) + 1

    status_str = ", ".join(f"{count} {status}" for status, count in sorted(by_status.items()))
    console.print(f"\n[bold]{len(seats)} seats:[/bold] {status_str}")

    available = [s for s in seats if s.status == "available"]
    if not available:
        console.print("[red]No available seats.[/red]")
        return []

    # Score all available seats
    all_rows = sorted(set(s.row for s in seats))
    total_rows = len(all_rows)
    row_max_seat: dict[str, int] = {}
    for s in seats:
        row_max_seat[s.row] = max(row_max_seat.get(s.row, 0), s.number)

    for seat in available:
        seat.score = score_seat(seat, total_rows, row_max_seat.get(seat.row, 20))

    available.sort(key=lambda s: s.score, reverse=True)

    table = Table(title="Best available seats")
    table.add_column("#", style="dim", width=3)
    table.add_column("Seat", style="bold cyan")
    table.add_column("Score", style="green")
    table.add_column("Notes", style="dim", max_width=50)

    for i, seat in enumerate(available[:top_n], 1):
        label = f"{seat.row}{seat.number}"
        notes = ""
        if seat.is_wheelchair:
            notes = "wheelchair space"
        elif seat.message:
            notes = seat.message[:50]
        table.add_row(str(i), label, f"{seat.score:.3f}", notes)

    console.print(table)
    return available


async def monitor_loop(config: MonitorConfig):
    """Main monitoring loop."""
    console.print(Panel(
        f"[bold]BFI IMAX seat monitor[/bold]\n"
        f"Film: {config.film_slug}\n"
        f"Poll interval: {config.poll_interval_seconds}s\n"
        f"Min score: {config.min_score}\n"
        f"Mode: {'headless' if config.headless else 'visible'}",
        title="Config",
    ))

    previous_available: set[str] = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=config.headless,
            args=["--disable-blink-features=AutomationControlled"],
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

        poll_count = 0
        while True:
            poll_count += 1
            now = datetime.now().strftime("%H:%M:%S")
            console.rule(f"[bold]Poll #{poll_count} at {now}[/bold]")

            try:
                if config.performance_id:
                    seats = await load_seat_map(page, config.performance_id)
                else:
                    screenings = await get_screenings(page, config.film_slug)
                    console.print(f"Found {len(screenings)} screening link(s)")
                    for s in screenings[:10]:
                        console.print(f"  {s.get('text', '?')[:60]}  perf={s.get('performanceId', 'N/A')}")

                    perf_id = next((s["performanceId"] for s in screenings if s.get("performanceId")), None)
                    if not perf_id:
                        console.print("[red]No performance ID found. Use --performance-id.[/red]")
                        if config.poll_interval_seconds <= 0:
                            break
                        await asyncio.sleep(config.poll_interval_seconds)
                        continue

                    seats = await load_seat_map(page, perf_id)

                available = display_seats(seats, config.top_n)

                # Detect newly available seats (cancellations)
                current_keys = {f"{s.row}{s.number}" for s in available}
                new_keys = current_keys - previous_available

                if new_keys and poll_count > 1:
                    new_seats = [s for s in available if f"{s.row}{s.number}" in new_keys and not s.is_wheelchair]
                    good_new = [s for s in new_seats if s.score >= config.min_score]

                    if good_new:
                        msg = ", ".join(f"{s.row}{s.number} ({s.score:.2f})" for s in good_new[:5])
                        console.print(f"\n[bold green]NEW SEATS![/bold green] {msg}")
                        macos_notify("BFI IMAX — seats opened up!", msg)
                    elif new_seats:
                        console.print(f"[dim]{len(new_seats)} new seat(s) but below score threshold[/dim]")

                previous_available = current_keys

            except Exception as e:
                console.print(f"[red]Error: {e}[/red]")
                try:
                    await page.screenshot(path="debug_screenshot.png")
                    console.print("[dim]Saved debug_screenshot.png[/dim]")
                except Exception:
                    pass

            if config.poll_interval_seconds <= 0:
                break

            console.print(f"\n[dim]Next poll in {config.poll_interval_seconds}s — Ctrl+C to stop[/dim]")
            await asyncio.sleep(config.poll_interval_seconds)

        await browser.close()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="BFI IMAX seat availability monitor")
    parser.add_argument("film_slug", help="Film permalink slug (e.g. 'project-hail-mary')")
    parser.add_argument("--performance-id", "-p", help="Specific screening GUID")
    parser.add_argument("--interval", "-i", type=int, default=60, help="Poll interval in seconds (0 = single-shot)")
    parser.add_argument("--min-score", type=float, default=0.5, help="Min seat score for alerts (default: 0.5)")
    parser.add_argument("--top-n", type=int, default=10, help="Top N seats to show")
    parser.add_argument("--visible", action="store_true", help="Show browser window")
    args = parser.parse_args()

    config = MonitorConfig(
        film_slug=args.film_slug,
        performance_id=args.performance_id,
        poll_interval_seconds=args.interval,
        min_score=args.min_score,
        top_n=args.top_n,
        headless=not args.visible,
    )

    try:
        asyncio.run(monitor_loop(config))
    except KeyboardInterrupt:
        console.print("\n[bold]Stopped.[/bold]")


if __name__ == "__main__":
    main()
