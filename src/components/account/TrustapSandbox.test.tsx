import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { trustapOrder } from "@/test/trustap-fixture";
const h = vi.hoisted(() => ({ get: vi.fn(), confirm: vi.fn(), drafts: vi.fn(), create: vi.fn() }));
vi.mock("./AuthProvider", () => ({
  useAuth: () => ({
    session: { user: { id: "12345678-1234-4234-8234-123456789015" }, access_token: "token" },
  }),
}));
vi.mock("./AccountLayout", () => ({
  AccountLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccountPanel: ({ children, title }: { children: ReactNode; title: string }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Field: ({ children, label }: { children: ReactNode; label: string }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  Message: ({ error, success }: { error: string; success: string }) => (
    <div>
      {error}
      {success}
    </div>
  ),
}));
vi.mock("@/lib/listing-drafts.functions", () => ({ getListingDrafts: h.drafts }));
vi.mock("@/lib/trustap-sandbox.functions", () => ({
  getTrustapSandbox: h.get,
  createTrustapSandboxOrder: h.create,
  reconcileTrustapSandbox: vi.fn(),
  acceptSandboxPayment: vi.fn(),
  checkSandboxOwnership: vi.fn(),
  confirmSandboxFiles: h.confirm,
  downloadSandboxPurchase: vi.fn(),
  discardSandboxPreparation: vi.fn(),
  startTrustapConnection: vi.fn(),
}));
import { TrustapSandbox } from "./TrustapSandbox";
beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockResolvedValue({
    admin: false,
    configured: true,
    connected: true,
    orders: [
      {
        ...trustapOrder,
        files: [{ id: trustapOrder.request_id, filename: "test.zip", ready: true }],
        events: [],
        complaint_deadline: null,
      },
    ],
  });
  h.confirm.mockResolvedValue({});
  window.history.replaceState({}, "", "/account/payments");
});
it("shows the exact buyer total and disables unfunded downloads", async () => {
  render(<TrustapSandbox />);
  await screen.findByText("Test project");
  expect(screen.getByText(/Buyer total \$52.90/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Prepare test order" })).not.toBeInTheDocument();
});
it("requires a separate confirmation before reporting file delivery", async () => {
  h.get.mockResolvedValue({
    admin: false,
    configured: true,
    connected: true,
    orders: [{ ...trustapOrder, state: "funded", files: [], events: [], complaint_deadline: null }],
  });
  render(<TrustapSandbox />);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm files received" }));
  expect(h.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "I received and checked the files" }));
  await waitFor(() =>
    expect(h.confirm).toHaveBeenCalledWith({
      data: { token: "token", id: trustapOrder.id, confirm: true },
    }),
  );
});
