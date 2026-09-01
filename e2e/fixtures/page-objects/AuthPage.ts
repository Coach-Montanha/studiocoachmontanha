import { type Page, expect } from "@playwright/test";

export class AuthPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/auth");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async switchToSignUp() {
    await this.page.locator('[data-testid="tab-signup"]').click();
    await expect(this.page.locator('[data-testid="form-signup"]')).toBeVisible();
  }

  async switchToSignIn() {
    await this.page.locator('[data-testid="tab-signin"]').click();
    await expect(this.page.locator('[data-testid="form-signin"]')).toBeVisible();
  }

  async signUp(name: string, email: string, password: string) {
    await this.switchToSignUp();
    await this.page.locator('[data-testid="input-signup-name"]').fill(name);
    await this.page.locator('[data-testid="input-signup-email"]').fill(email);
    await this.page.locator('[data-testid="input-signup-password"]').fill(password);
    await this.page.locator('[data-testid="button-signup-submit"]').click();
  }

  async signIn(email: string, password: string) {
    await this.switchToSignIn();
    await this.page.locator('[data-testid="input-signin-email"]').fill(email);
    await this.page.locator('[data-testid="input-signin-password"]').fill(password);
    await this.page.locator('[data-testid="button-signin-submit"]').click();
  }

  async forgotPassword(email: string) {
    await this.switchToSignIn();
    await this.page.locator('[data-testid="button-forgot-password"]').click();
    await expect(this.page.locator('[data-testid="form-reset-password"]')).toBeVisible();
    await this.page.locator('[data-testid="input-reset-email"]').fill(email);
    await this.page.locator('[data-testid="button-reset-submit"]').click();
  }

  async expectResetSuccess() {
    await expect(this.page.locator('[data-testid="reset-success-container"]')).toBeVisible();
  }

  async expectErrorMessage(text?: string | RegExp) {
    if (text) {
      await expect(this.page.getByText(text)).toBeVisible();
    }
  }
}
