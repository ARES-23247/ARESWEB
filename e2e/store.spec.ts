import { test, expect } from "./fixtures";

test.describe("Store checkout availability", () => {
  test("does not offer checkout until verified payments are connected", async ({
    page,
  }) => {
    await page.goto("/store");

    await expect(
      page.getByRole("heading", {
        name: "Online ordering is not available yet",
      }),
    ).toBeVisible();
    await expect(page.getByText("Checkout unavailable")).toBeVisible();
    await expect(page.getByRole("button", { name: /checkout/i })).toHaveCount(
      0,
    );
    await expect(page).not.toHaveURL(/success=true/);
  });
});

