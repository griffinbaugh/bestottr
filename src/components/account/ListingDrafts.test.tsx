import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), list: vi.fn() }));
vi.mock("./AuthProvider", () => ({
  useAuth: () => ({
    session: {
      access_token: "test-session",
      user: { id: "qa-user", email_confirmed_at: "2026-10-21" },
    },
    roblox: { username: "Owner" },
  }),
}));
vi.mock("./AccountLayout", () => ({
  RequireAccount: ({ children }: any) => children,
  Field: ({ label, children }: any) => (
    <label>
      {label}
      {children}
    </label>
  ),
  Message: ({ error, success }: any) => (
    <div>
      {error}
      {success}
    </div>
  ),
}));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: any) => <a>{children}</a> }));
vi.mock("@/lib/listing-drafts.functions", () => ({
  getListingDrafts: mocks.list,
  saveListingDraft: mocks.save,
  deleteListingDraft: vi.fn(),
}));
import { ListingDrafts } from "./ListingDrafts";
it("restores the retry deadline after a page reload", async () => {
  vi.useFakeTimers();
  sessionStorage.setItem("bestottr-listing-retry:qa-user", String(Date.now() + 45_000));
  mocks.list.mockResolvedValue([]);
  render(<ListingDrafts />);
  await act(async () => {});
  expect(screen.getByRole("button", { name: "Try again in 45s" })).toBeDisabled();
  expect(mocks.save).not.toHaveBeenCalled();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  sessionStorage.clear();
  vi.clearAllMocks();
});
it("keeps edits while counting down a rate limit and does not retry automatically", async () => {
  vi.useFakeTimers();
  mocks.list.mockResolvedValue([]);
  mocks.save.mockResolvedValue({
    ok: false,
    error: "Roblox is limiting ownership checks.",
    retryAfterSeconds: 90,
  });
  render(<ListingDrafts />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText("Roblox link"), {
    target: { value: "https://roblox.com/games/100" },
  });
  fireEvent.change(screen.getByLabelText("Listing title"), { target: { value: "My saved title" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Verify ownership & save draft" }));
  });
  expect(screen.getByRole("button", { name: "Try again in 90s" })).toBeDisabled();
  expect(screen.getByLabelText("Listing title")).toHaveValue("My saved title");
  expect(screen.getByLabelText("Listing title")).toBeEnabled();
  await act(async () => {
    vi.advanceTimersByTime(90_000);
  });
  expect(screen.getByRole("button", { name: "Verify ownership & save draft" })).toBeEnabled();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Listing title")).toHaveValue("My saved title");
});
