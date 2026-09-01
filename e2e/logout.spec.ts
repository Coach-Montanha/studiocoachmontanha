import { test, expect } from "./fixtures/auth.fixture";

test.describe("Session Termination (Logout) & Route Protection", () => {
  test("should log user out when clicking logout button and redirect to auth", async ({
    authenticatedPage,
    appShell,
    page,
  }) => {
    // Navigate to dashboard with authenticated session
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await appShell.expectUserConnected("admin.coach@example.com");

    // Click logout
    await appShell.logout();

    // Verify redirected to /auth
    await appShell.expectLoggedOut();
  });

  test("should redirect unauthenticated users away from protected routes to auth page", async ({
    page,
  }) => {
    // Clear any storage state
    await page.goto("/auth");
    await page.evaluate(() => localStorage.clear());

    // Attempt direct navigation to protected student list
    await page.goto("/students");
    await expect(page).toHaveURL(/\/auth/);

    // Attempt direct navigation to protected payments
    await page.goto("/payments");
    await expect(page).toHaveURL(/\/auth/);
  });
});
