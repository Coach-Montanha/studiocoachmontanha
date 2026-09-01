import { test, expect } from "./fixtures/auth.fixture";

test.describe("Payments Management Journey", () => {
  test.beforeEach(async ({ authenticatedPage, paymentsPage }) => {
    // Mock students list for payment dropdown
    await authenticatedPage.route("**/rest/v1/students*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "student-1", name: "Lucas Silva", status: "active" },
          { id: "student-2", name: "Mariana Oliveira", status: "active" },
        ]),
      });
    });

    // Mock plans list
    await authenticatedPage.route("**/rest/v1/plans*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "plan-1", name: "Plano Mensal Gold", price: 150.0, billing_cycle: "monthly" },
        ]),
      });
    });

    // Mock payments list
    await authenticatedPage.route("**/rest/v1/payments*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "payment-1",
              student_id: "student-1",
              plan_id: "plan-1",
              amount: 150.0,
              payment_date: "2026-08-10",
              due_date: "2026-09-10",
              reference_month: "2026-08",
              payment_method: "pix",
              status: "paid",
              students: { name: "Lucas Silva" },
              plans: { name: "Plano Mensal Gold" },
            },
          ]),
        });
      } else if (route.request().method() === "POST") {
        const payload = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: "payment-2", ...payload }]),
        });
      } else {
        await route.continue();
      }
    });

    await paymentsPage.goto();
  });

  test.describe("Happy Paths", () => {
    test("should list payments in table on page load", async ({ paymentsPage }) => {
      await paymentsPage.expectPaymentInTable("Lucas Silva");
    });

    test("should register a new payment successfully", async ({ paymentsPage, page }) => {
      await paymentsPage.openNewPaymentDialog();
      await paymentsPage.selectStudent("Mariana Oliveira");
      await paymentsPage.fillPaymentForm({
        amount: "150.00",
        referenceMonth: "2026-08",
        paymentDate: "2026-08-15",
        notes: "Pagamento via Pix aprovado",
      });
      await paymentsPage.savePayment();

      await expect(page.getByText(/Pagamento registrado/i)).toBeVisible();
      await paymentsPage.expectPaymentDialogClosed();
    });

    test("should filter payments by student name in search input", async ({ paymentsPage, page }) => {
      await paymentsPage.searchPayment("Lucas");
      await expect(page.locator('[data-testid="table-payments"]').getByText("Lucas Silva")).toBeVisible();
    });
  });

  test.describe("Failure States", () => {
    test("should show error toast when saving payment with missing required fields", async ({ paymentsPage, page }) => {
      await paymentsPage.openNewPaymentDialog();
      // Leave student and amount empty, click save
      await paymentsPage.savePayment();

      await expect(page.getByText(/Preencha os campos obrigatórios/i)).toBeVisible();
      await paymentsPage.expectPaymentDialogVisible();
    });

    test("should handle backend failure gracefully when registering payment", async ({ paymentsPage, page }) => {
      await page.route("**/rest/v1/payments*", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Internal server error during transaction" }),
          });
        } else {
          await route.continue();
        }
      });

      await paymentsPage.openNewPaymentDialog();
      await paymentsPage.selectStudent("Lucas Silva");
      await paymentsPage.fillPaymentForm({
        amount: "200.00",
        referenceMonth: "2026-08",
        paymentDate: "2026-08-15",
      });
      await paymentsPage.savePayment();

      await expect(page.getByText(/Internal server error/i)).toBeVisible();
      await paymentsPage.expectPaymentDialogVisible();
    });
  });
});
