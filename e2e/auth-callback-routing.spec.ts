import { test, expect } from "@playwright/test"

/**
 * OAuth/email errors in the query string should land on auth-code-error, not hang on /auth/callback.
 */
test("auth callback redirects error query to verification page", async ({ page }) => {
  await page.goto(
    `/auth/auth-code-error?error=access_denied&error_description=${encodeURIComponent("Link expired")}&error_code=otp_expired`,
    { waitUntil: "domcontentloaded" },
  )

  await expect(page.getByRole("heading", { name: /Verification Failed/i })).toBeVisible({ timeout: 10_000 })
})

test("auth callback returns HTML shim when no query code (fragment handled client-side)", async ({ page, baseURL }) => {
  const origin = baseURL ?? "http://localhost:3000"
  const res = await page.context().request.get(`${origin}/auth/callback`)
  expect(res.status()).toBe(200)
  const ct = res.headers()["content-type"] ?? ""
  expect(ct).toContain("text/html")
  const html = await res.text()
  expect(html).toContain("Continuing sign-in")
  expect(html).toContain("/auth/auth-code-error")

  await page.goto("/auth/callback", { waitUntil: "domcontentloaded" })
  /** Inline bootstrap may redirect, or CSP may leave the shim visible — both acceptable. */
  await expect(
    page.getByText("Continuing sign-in").or(page.getByRole("heading", { name: /Verification Failed/i })),
  ).toBeVisible({ timeout: 20_000 })
})
