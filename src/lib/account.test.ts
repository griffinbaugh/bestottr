import { describe, it, expect } from "vitest";
import { safeReturnTo, passwordIssue, profileSchema } from "./account";
describe("Account security inputs", () => {
  it("keeps a legitimate internal destination and query", () => {
    expect(safeReturnTo("/account/profile?from=login")).toBe("/account/profile?from=login");
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%2fevil.example",
    "/%5cevil.example",
    "javascript:alert(1)",
    "/login",
    "/auth/callback",
    "/%",
  ])("rejects redirect abuse: %s", (url) => {
    expect(safeReturnTo(url)).toBe("/account");
  });
  it("rejects passwords too short for new accounts", () => {
    expect(passwordIssue("short")).toBeTruthy();
    expect(passwordIssue("a unique passphrase")).toBeNull();
  });
  it("normalizes handles but rejects markup or unexpected profile fields", () => {
    const p = profileSchema.parse({
      display_name: " Example ",
      handle: "Creator_1",
      bio: "Hi",
      role: "admin",
    });
    expect(p).toEqual({ display_name: "Example", handle: "creator_1", bio: "Hi" });
    expect(
      profileSchema.safeParse({ display_name: "Example", handle: "<script>", bio: "" }).success,
    ).toBe(false);
  });
});
