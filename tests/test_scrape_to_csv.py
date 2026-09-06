import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import scrape_to_csv as scraper


class ScrapeTests(unittest.IsolatedAsyncioTestCase):
    async def test_seat_map_returns_seats_and_sold_out_flag(self):
        page = AsyncMock()
        seats = [{"row": "A", "seat": i, "status": "A"} for i in range(1, 4)]
        page.evaluate.side_effect = [False, seats]
        with patch.object(scraper, "wait_out_challenge", new=AsyncMock()):
            self.assertEqual(await scraper.scrape_performance(page, "test"), (seats, False))

    async def test_sold_out_has_no_seats(self):
        page = AsyncMock()
        page.evaluate.return_value = True
        with patch.object(scraper, "wait_out_challenge", new=AsyncMock()):
            self.assertEqual(await scraper.scrape_performance(page, "test"), ([], True))
        page.wait_for_selector.assert_not_called()

    async def run_main_with_result(self, result):
        browser = AsyncMock()
        playwright = MagicMock()
        playwright.chromium.launch = AsyncMock(return_value=browser)
        manager = MagicMock()
        manager.__aenter__ = AsyncMock(return_value=playwright)
        manager.__aexit__ = AsyncMock(return_value=False)
        performances = [
            {"performance_id": "failed", "film_slug": "film"},
            {"performance_id": "sold", "film_slug": "film", "listed_sold_out": True},
        ]
        scrape = AsyncMock(side_effect=result) if isinstance(result, Exception) else AsyncMock(return_value=result)
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(scraper, "DATA_DIR", Path(tmp)), \
             patch.object(scraper, "async_playwright", return_value=manager), \
             patch.object(scraper, "discover_performances", new=AsyncMock(return_value=performances)), \
             patch.object(scraper, "scrape_performance", new=scrape), \
             patch.object(scraper, "update_index") as update, \
             patch.object(scraper, "append_to_csv") as append:
            with self.assertRaisesRegex(RuntimeError, "Failed to scrape 1 screening"):
                await scraper.main()
            self.assertEqual(update.call_args.args[0], [performances[1]])
            self.assertEqual(update.call_args.args[2], {"sold": True})
            append.assert_not_called()
            browser.close.assert_awaited_once()

    async def test_errors_fail_run_and_do_not_refresh_failed_screenings(self):
        await self.run_main_with_result(ValueError("broken map"))

    async def test_empty_maps_fail_run_and_do_not_refresh_failed_screenings(self):
        await self.run_main_with_result(([], False))


if __name__ == "__main__":
    unittest.main()
