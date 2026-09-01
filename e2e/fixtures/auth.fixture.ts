import { test as base, type Page } from "@playwright/test";
import { AuthPage } from "./page-objects/AuthPage";
import { AppShellPage } from "./page-objects/AppShellPage";
import { StudentsPage } from "./page-objects/StudentsPage";
import { PaymentsPage } from "./page-objects/PaymentsPage";

export type TestUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "student" | "super_admin";
};

export const defaultAdminUser: TestUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin.coach@example.com",
  name: "Coach Montanha",
  role: "admin",
};

/**
 * Injects a mock authenticated Supabase session into browser localStorage.
 */
export async function injectAuthenticatedSession(page: Page, user: TestUser = defaultAdminUser) {
  const fakeSession = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock-refresh-token",
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { name: user.name },
      app_metadata: { provider: "email", providers: ["email"] },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  await page.addInitScript(
    ({ session }) => {
      // Find supabase storage key or set standard auth token
      const keys = Object.keys(localStorage);
      const authKey = keys.find((k) => k.endsWith("-auth-token")) || "sb-auth-token";
      localStorage.setItem(authKey, JSON.stringify(session));
    },
    { session: fakeSession },
  );
}

type MyFixtures = {
  authPage: AuthPage;
  appShell: AppShellPage;
  studentsPage: StudentsPage;
  paymentsPage: PaymentsPage;
  authenticatedPage: Page;
};

export const test = base.extend<MyFixtures>({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  appShell: async ({ page }, use) => {
    await use(new AppShellPage(page));
  },
  studentsPage: async ({ page }, use) => {
    await use(new StudentsPage(page));
  },
  paymentsPage: async ({ page }, use) => {
    await use(new PaymentsPage(page));
  },
  authenticatedPage: async ({ page }, use) => {
    await injectAuthenticatedSession(page, defaultAdminUser);
    await use(page);
  },
});

export { expect } from "@playwright/test";
