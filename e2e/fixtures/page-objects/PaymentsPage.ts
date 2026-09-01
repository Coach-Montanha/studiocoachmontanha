import { type Page, expect } from "@playwright/test";

export class PaymentsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/payments");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openNewPaymentDialog() {
    await this.page.locator('[data-testid="button-new-payment"]').click();
    await expect(this.page.locator('[data-testid="dialog-payment"]')).toBeVisible();
  }

  async selectStudent(studentName: string) {
    await this.page.locator('[data-testid="select-payment-student"]').click();
    await this.page.getByRole("option", { name: studentName }).click();
  }

  async fillPaymentForm(data: {
    amount: string | number;
    referenceMonth?: string;
    paymentDate?: string;
    notes?: string;
  }) {
    if (data.amount !== undefined) {
      await this.page.locator('[data-testid="input-payment-amount"]').fill(String(data.amount));
    }
    if (data.referenceMonth) {
      await this.page.locator('[data-testid="input-payment-reference-month"]').fill(data.referenceMonth);
    }
    if (data.paymentDate) {
      await this.page.locator('[data-testid="input-payment-date"]').fill(data.paymentDate);
    }
    if (data.notes) {
      await this.page.locator('[data-testid="input-payment-notes"]').fill(data.notes);
    }
  }

  async savePayment() {
    await this.page.locator('[data-testid="button-save-payment"]').click();
  }

  async createPayment(data: {
    studentName: string;
    amount: string | number;
    referenceMonth?: string;
    paymentDate?: string;
    notes?: string;
  }) {
    await this.openNewPaymentDialog();
    await this.selectStudent(data.studentName);
    await this.fillPaymentForm(data);
    await this.savePayment();
  }

  async searchPayment(query: string) {
    await this.page.locator('[data-testid="input-search-payments"]').fill(query);
  }

  async expectPaymentInTable(studentName: string) {
    await expect(this.page.locator('[data-testid="table-payments"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="table-payments"]').getByText(studentName)).toBeVisible();
  }

  async expectPaymentDialogVisible() {
    await expect(this.page.locator('[data-testid="dialog-payment"]')).toBeVisible();
  }

  async expectPaymentDialogClosed() {
    await expect(this.page.locator('[data-testid="dialog-payment"]')).not.toBeVisible();
  }
}
