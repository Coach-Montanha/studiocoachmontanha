import { type Page, expect } from "@playwright/test";

export class StudentsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/students");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openNewStudentDialog() {
    await this.page.locator('[data-testid="button-new-student"]').click();
    await expect(this.page.locator('[data-testid="dialog-student"]')).toBeVisible();
  }

  async fillStudentForm(data: {
    name: string;
    email?: string;
    phone?: string;
    birthDate?: string;
  }) {
    await this.page.locator('[data-testid="input-student-name"]').fill(data.name);
    if (data.email) {
      await this.page.locator('[data-testid="input-student-email"]').fill(data.email);
    }
    if (data.phone) {
      await this.page.locator('[data-testid="input-student-phone"]').fill(data.phone);
    }
    if (data.birthDate) {
      await this.page.locator('[data-testid="input-student-birthdate"]').fill(data.birthDate);
    }
  }

  async saveStudent() {
    await this.page.locator('[data-testid="button-save-student"]').click();
  }

  async createStudent(data: {
    name: string;
    email?: string;
    phone?: string;
    birthDate?: string;
  }) {
    await this.openNewStudentDialog();
    await this.fillStudentForm(data);
    await this.saveStudent();
  }

  async searchStudent(name: string) {
    await this.page.locator('[data-testid="input-search-students"]').fill(name);
  }

  async expectStudentInList(name: string) {
    await expect(this.page.getByText(name, { exact: false })).toBeVisible();
  }

  async expectStudentDialogVisible() {
    await expect(this.page.locator('[data-testid="dialog-student"]')).toBeVisible();
  }

  async expectStudentDialogClosed() {
    await expect(this.page.locator('[data-testid="dialog-student"]')).not.toBeVisible();
  }
}
