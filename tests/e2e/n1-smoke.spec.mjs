import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL || "";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || "";

async function isVisible(locator) {
  if ((await locator.count()) === 0) return false;
  try {
    return await locator.first().isVisible({ timeout: 1500 });
  } catch {
    return false;
  }
}

async function clickIfVisible(locator) {
  if (await isVisible(locator)) {
    await locator.first().click();
  }
}

async function dismissCompliance(page) {
  await clickIfVisible(page.getByTestId("age-gate-accept"));
  await clickIfVisible(page.getByTestId("cookie-consent-reject"));
}

async function ensureLogin(page) {
  if (await isVisible(page.getByTestId("header-profile-link"))) return;

  await expect(page.getByTestId("auth-card")).toBeVisible();
  await page.getByTestId("auth-identifier-input").fill(E2E_EMAIL);
  await page.getByTestId("auth-password-input").fill(E2E_PASSWORD);
  await page.getByTestId("auth-submit-button").click();
  await expect(page.getByTestId("header-profile-link")).toBeVisible({ timeout: 20_000 });
}

test.describe("N1 smoke", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "E2E_USER_EMAIL and E2E_USER_PASSWORD env vars are required.");

  test("auth + log + profile + social", async ({ page }) => {
    await page.goto("/");
    await dismissCompliance(page);
    await ensureLogin(page);

    await page.goto("/?section=log");
    await expect(page.getByTestId("log-wizard")).toBeVisible();
    await page.getByTestId("log-format-draft").click();
    await page.getByTestId("log-next-button").click();
    await expect(page.getByTestId("log-step-beer-panel")).toBeVisible();

    const pinnedChip = page.getByTestId("beer-combobox-pinned-chip").first();
    if (await isVisible(pinnedChip)) {
      await pinnedChip.click();
    } else {
      await page.getByTestId("beer-combobox-input").fill("Efes");
      await page.getByTestId("beer-combobox-toggle").click();
      const firstOption = page.getByTestId("beer-combobox-option").first();
      await expect(firstOption).toBeVisible();
      await firstOption.click();
    }

    await page.getByTestId("log-next-button").click();
    await expect(page.getByTestId("log-step-detail-panel")).toBeVisible();
    await page.getByTestId("log-next-button").click();
    await expect(page.getByTestId("log-step-confirm-panel")).toBeVisible();

    const profileLink = page.getByTestId("header-profile-link");
    await expect(profileLink).toBeVisible();
    const profileHref = await profileLink.getAttribute("href");
    expect(profileHref || "").toContain("/u/");
    await profileLink.click();

    await expect(page).toHaveURL(/\/u\//);
    await expect(page.getByTestId("profile-root")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("profile-handle")).toContainText("@");

    await page.goto("/?section=social");
    await expect(page.getByTestId("social-panel-root")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("social-panel-heading")).toBeVisible();
  });
});
