import { test, expect } from "./fixtures/auth.fixture";

test.describe("Authentication & Access Journey", () => {
  test.beforeEach(async ({ authPage }) => {
    await authPage.goto();
  });

  test.describe("Happy Paths", () => {
    test("should display login form by default with all critical elements", async ({ page }) => {
      await expect(page.locator('[data-testid="tab-signin"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-signup"]')).toBeVisible();
      await expect(page.locator('[data-testid="input-signin-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="input-signin-password"]')).toBeVisible();
      await expect(page.locator('[data-testid="button-signin-submit"]')).toBeVisible();
    });

    test("should allow switching between Sign In and Sign Up tabs", async ({ authPage, page }) => {
      await authPage.switchToSignUp();
      await expect(page.locator('[data-testid="input-signup-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="input-signup-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="input-signup-password"]')).toBeVisible();
      await expect(page.locator('[data-testid="button-signup-submit"]')).toBeVisible();

      await authPage.switchToSignIn();
      await expect(page.locator('[data-testid="input-signin-email"]')).toBeVisible();
    });

    test("should submit sign up form with valid input", async ({ authPage, page }) => {
      // Mock Supabase sign up API response
      await page.route("**/auth/v1/signup*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "new-user-id",
            email: "novo.treinador@example.com",
            user_metadata: { name: "Treinador Teste" },
          }),
        });
      });

      await authPage.signUp("Treinador Teste", "novo.treinador@example.com", "SenhaForte123!");
      await expect(page.getByText(/Conta criada/i)).toBeVisible();
    });

    test("should submit login form with valid credentials", async ({ authPage, page }) => {
      // Mock Supabase sign in API response
      await page.route("**/auth/v1/token*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "fake-jwt-token",
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "fake-refresh-token",
            user: {
              id: "00000000-0000-4000-8000-000000000001",
              email: "admin.coach@example.com",
              user_metadata: { name: "Coach Montanha" },
            },
          }),
        });
      });

      await authPage.signIn("admin.coach@example.com", "SenhaCorreta123");
      await expect(page.getByText(/Bem-vindo de volta/i)).toBeVisible();
    });

    test("should request password reset with valid email", async ({ authPage, page }) => {
      await page.route("**/auth/v1/recover*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      });

      await authPage.forgotPassword("admin.coach@example.com");
      await authPage.expectResetSuccess();
    });
  });

  test.describe("Failure States", () => {
    test("should show error toast when signing in with incorrect password", async ({ authPage, page }) => {
      await page.route("**/auth/v1/token*", async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "invalid_grant",
            error_description: "Invalid login credentials",
            message: "Invalid login credentials",
          }),
        });
      });

      await authPage.signIn("admin.coach@example.com", "SenhaInvalida!");
      await expect(page.getByText(/Invalid login credentials/i)).toBeVisible();
    });

    test("should prevent signup when password is too short (< 6 characters)", async ({ authPage, page }) => {
      await authPage.switchToSignUp();
      await page.locator('[data-testid="input-signup-name"]').fill("Treinador");
      await page.locator('[data-testid="input-signup-email"]').fill("treinador@example.com");
      await page.locator('[data-testid="input-signup-password"]').fill("123");

      const submitButton = page.locator('[data-testid="button-signup-submit"]');
      await submitButton.click();

      // HTML5 minLength validation or prompt
      const pwdInput = page.locator('[data-testid="input-signup-password"]');
      const isInvalid = await pwdInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
      expect(isInvalid).toBe(true);
    });

    test("should show error when password recovery fails on server", async ({ authPage, page }) => {
      await page.route("**/auth/v1/recover*", async (route) => {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            message: "For security purposes, you can only request this once every 60 seconds",
          }),
        });
      });

      await authPage.forgotPassword("admin.coach@example.com");
      await expect(page.locator('[data-testid="reset-error-message"]')).toBeVisible();
    });
  });
});
