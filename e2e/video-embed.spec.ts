import { expect, test } from "./fixtures";

test("blog video can initialize provider storage while remaining cross-origin", async ({ page }) => {
  await page.route("**/api/content/posts/video-embed-regression", (route) => route.fulfill({
    json: { post: {
      slug: "video-embed-regression",
      title: "Video embed regression fixture",
      content: '<iframe src="https://www.youtube.com/embed/827aNTABAho" title="Team video"></iframe>',
    } },
  }));
  // Reproduce the provider's actual failing browser API without relying on
  // YouTube availability or account/cookie prompts in CI. No playback is mocked.
  await page.route("https://www.youtube.com/embed/827aNTABAho", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><body><p id="result">Loading</p><script>
      try {
        if (!window.caches) throw new Error('Cache storage unavailable');
        let parentBlocked = false;
        try { void parent.document; } catch { parentBlocked = true; }
        document.getElementById('result').textContent = parentBlocked
          ? 'Provider storage available; parent isolated' : 'Parent access unexpectedly allowed';
      } catch (error) { document.getElementById('result').textContent = error.message; }
    </script></body></html>`,
  }));
  await page.goto("/blog/video-embed-regression", { waitUntil: "networkidle" });
  const frame = page.getByTitle("Team video");
  await frame.scrollIntoViewIfNeeded();
  await expect(page.frameLocator('iframe[title="Team video"]').getByText("Provider storage available; parent isolated")).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch on YouTube" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=827aNTABAho");
});
