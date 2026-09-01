import { test, expect } from "./fixtures/auth.fixture";

test.describe("Full Critical User Journey", () => {
  test("complete end-to-end lifecycle: Login -> Create Student -> Record Payment -> Logout", async ({
    page,
    authPage,
    appShell,
    studentsPage,
    paymentsPage,
  }) => {
    // 1. Mock Authentication & Backend Endpoints
    await page.route("**/auth/v1/token*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-e2e-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-e2e-refresh",
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            email: "admin.coach@example.com",
            user_metadata: { name: "Coach Montanha" },
          },
        }),
      });
    });

    const studentsDb: any[] = [];
    const paymentsDb: any[] = [];

    await page.route("**/rest/v1/students*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(studentsDb),
        });
      } else if (route.request().method() === "POST") {
        const payload = JSON.parse(route.request().postData() || "{}");
        const newStudent = {
          id: `stu-${Date.now()}`,
          ...payload,
          payments: [],
          student_plan_history: [],
          created_at: new Date().toISOString(),
        };
        studentsDb.push(newStudent);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(newStudent),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/rest/v1/payments*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(paymentsDb),
        });
      } else if (route.request().method() === "POST") {
        const payload = JSON.parse(route.request().postData() || "{}");
        const student = studentsDb.find((s) => s.id === payload.student_id);
        const newPayment = {
          id: `pay-${Date.now()}`,
          ...payload,
          students: { name: student?.name ?? "Aluno" },
          plans: null,
        };
        paymentsDb.push(newPayment);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([newPayment]),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/rest/v1/user_roles*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ role: "admin", user_id: "00000000-0000-4000-8000-000000000001" }]),
      });
    });

    // Step 1: Login
    await authPage.goto();
    await authPage.signIn("admin.coach@example.com", "MinhaSenha123!");
    await page.waitForURL((url) => url.pathname === "/" || url.pathname.startsWith("/_authenticated"));

    // Step 2: Navigate to Students
    await appShell.navigateTo("students");
    await expect(page).toHaveURL(/\/students/);

    // Step 3: Create Student (Main Domain Action)
    await studentsPage.createStudent({
      name: "Juliana Mendes",
      email: "juliana.mendes@example.com",
      phone: "(11) 99999-1111",
      birthDate: "1992-03-25",
    });
    await expect(page.getByText(/Aluno criado/i)).toBeVisible();

    // Step 4: Navigate to Payments
    await appShell.navigateTo("payments");
    await expect(page).toHaveURL(/\/payments/);

    // Step 5: Record Payment
    await paymentsPage.createPayment({
      studentName: "Juliana Mendes",
      amount: "180.00",
      referenceMonth: "2026-08",
      paymentDate: "2026-08-20",
      notes: "Matrícula + Mensalidade",
    });
    await expect(page.getByText(/Pagamento registrado/i)).toBeVisible();

    // Step 6: Verify Payment Displayed in Table
    await paymentsPage.expectPaymentInTable("Juliana Mendes");

    // Step 7: Logout
    await appShell.logout();
    await appShell.expectLoggedOut();
  });
});
