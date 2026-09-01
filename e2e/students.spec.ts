import { test, expect } from "./fixtures/auth.fixture";

test.describe("Students Management (Main Action)", () => {
  test.beforeEach(async ({ authenticatedPage, studentsPage }) => {
    // Intercept student queries to return mock data for isolation
    await authenticatedPage.route("**/rest/v1/students*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "student-1",
              name: "Lucas Silva",
              email: "lucas.silva@example.com",
              phone: "(11) 98888-7777",
              status: "active",
              birth_date: "1995-05-15",
              created_at: new Date().toISOString(),
              payments: [],
              student_plan_history: [],
            },
          ]),
        });
      } else if (route.request().method() === "POST") {
        const payload = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "student-2",
            ...payload,
            created_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await studentsPage.goto();
  });

  test.describe("Happy Paths", () => {
    test("should list existing students on page load", async ({ studentsPage }) => {
      await studentsPage.expectStudentInList("Lucas Silva");
    });

    test("should open student modal, fill fields and save successfully", async ({ studentsPage, page }) => {
      await studentsPage.openNewStudentDialog();
      await studentsPage.fillStudentForm({
        name: "Mariana Oliveira",
        email: "mariana.oliveira@example.com",
        phone: "(11) 97777-6666",
        birthDate: "1998-08-20",
      });
      await studentsPage.saveStudent();

      await expect(page.getByText(/Aluno criado/i)).toBeVisible();
      await studentsPage.expectStudentDialogClosed();
    });

    test("should filter students by search query", async ({ studentsPage, page }) => {
      await studentsPage.searchStudent("Lucas");
      await expect(page.locator('[data-testid="table-students"]').getByText("Lucas Silva")).toBeVisible();
    });
  });

  test.describe("Failure States", () => {
    test("should prevent submission and show error toast when Name is empty", async ({ studentsPage, page }) => {
      await studentsPage.openNewStudentDialog();
      // Leave name empty and click save
      await studentsPage.saveStudent();

      await expect(page.getByText(/Nome obrigatório/i)).toBeVisible();
      await studentsPage.expectStudentDialogVisible();
    });

    test("should show error toast and retain form when backend insert fails", async ({ studentsPage, page }) => {
      await page.route("**/rest/v1/students*", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              message: "duplicate key value violates unique constraint",
              code: "23505",
            }),
          });
        } else {
          await route.continue();
        }
      });

      await studentsPage.openNewStudentDialog();
      await studentsPage.fillStudentForm({
        name: "Carlos Teste",
        email: "carlos.duplicado@example.com",
      });
      await studentsPage.saveStudent();

      await expect(page.getByText(/violates unique constraint/i)).toBeVisible();
      await studentsPage.expectStudentDialogVisible();
    });
  });
});
