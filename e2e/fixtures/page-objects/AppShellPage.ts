import { type Page, expect } from "@playwright/test";

export class AppShellPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateTo(section: "dashboard" | "students" | "payments" | "plans" | "agenda" | "settings") {
    const selector = `[data-testid="sidebar-nav-${section}"]`;
    await this.page.locator(selector).click();
  }

  async logout() {
    await this.page.locator('[data-testid="button-logout"]').click();
  }

  async expectUserConnected(email?: string) {
    const userDisplay = this.page.locator('[data-testid="user-email-display"]');
    await expect(userDisplay).toBeVisible();
    if (email) {
      await expect(userDisplay).toContainText(email);
    }
  }

  async expectLoggedOut() {
    await expect(this.page).toHaveURL(/\/auth/);
  }
}
