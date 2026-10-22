import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { escrowOrder } from "@/test/escrow-fixture";
const h = vi.hoisted(() => ({
  dashboard: vi.fn(),
  drafts: vi.fn(),
  create: vi.fn(),
  sync: vi.fn(),
  ownership: vi.fn(),
  download: vi.fn(),
  discard: vi.fn(),
  user: "buyer",
}));
vi.mock("./AuthProvider", () => ({
  useAuth: () => ({ session: { access_token: "qa-not-a-real-session", user: { id: h.user } } }),
}));
vi.mock("./AccountLayout", () => ({
  AccountLayout: ({ children }: any) => <div>{children}</div>,
  AccountPanel: ({ title, description, children }: any) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
  Field: ({ label, children }: any) => (
    <label>
      {label}
      {children}
    </label>
  ),
  Message: ({ error, success }: any) => (
    <>
      <div role="alert">{error}</div>
      <p>{success}</p>
    </>
  ),
}));
vi.mock("@/lib/listing-drafts.functions", () => ({ getListingDrafts: h.drafts }));
vi.mock("@/lib/escrow-sandbox.functions", () => ({
  getEscrowSandbox: h.dashboard,
  createEscrowSandboxOrder: h.create,
  reconcileEscrowSandbox: h.sync,
  checkSandboxOwnership: h.ownership,
  downloadSandboxPurchase: h.download,
  discardSandboxPreparation: h.discard,
  connectSandboxUpdates: vi.fn(),
}));
import { EscrowSandbox } from "./EscrowSandbox";
let order: any;
beforeEach(() => {
  vi.clearAllMocks();
  h.user = "buyer";
  order = {
    ...escrowOrder,
    files: [
      {
        id: "cc000000-0000-4000-8000-000000000003",
        order_id: escrowOrder.id,
        filename: "model.zip",
        size_bytes: 1024,
        ready: true,
      },
    ],
    events: [],
  };
  h.dashboard.mockImplementation(async () => ({
    configured: true,
    admin: h.user === "seller",
    orders: [order],
  }));
  h.drafts.mockResolvedValue([
    {
      id: "dd000000-0000-4000-8000-000000000004",
      title: "Project",
      format: "buy_now",
      price_cents: 12345,
    },
  ]);
});
afterEach(cleanup);
it("does not present unfunded files as downloadable or expose staff creation to the buyer", async () => {
  render(<EscrowSandbox />);
  await screen.findByText("Test project");
  expect(screen.getByRole("button", { name: "Download test purchase" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Create sandbox checkout" })).not.toBeInTheDocument();
  expect(screen.getByText("Sandbox only")).toBeInTheDocument();
});
it("checks a funded purchase on the server before attempting to navigate to a download", async () => {
  order.state = "funded";
  h.download.mockRejectedValue(new Error("Provider status could not be verified"));
  render(<EscrowSandbox />);
  await screen.findByText("Test project");
  fireEvent.click(screen.getByRole("button", { name: "Download test purchase" }));
  await screen.findByText("Provider status could not be verified");
  expect(h.download).toHaveBeenCalledWith({
    data: { token: "qa-not-a-real-session", id: order.id, fileId: order.files[0].id },
  });
});
it("preserves the creation request key after a failed request", async () => {
  h.user = "seller";
  h.create.mockRejectedValue(new Error("Unknown response; reconcile before retrying"));
  render(<EscrowSandbox />);
  await screen.findByText("Create a test order");
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "Project · $123.45" })).toBeInTheDocument(),
  );
  fireEvent.change(screen.getByLabelText("Saved draft"), {
    target: { value: "dd000000-0000-4000-8000-000000000004" },
  });
  fireEvent.change(screen.getByLabelText("Test buyer’s BestOttr handle"), {
    target: { value: "buyer" },
  });
  fireEvent.change(screen.getByLabelText("Buyer’s Escrow sandbox email"), {
    target: { value: "buyer@test.escrow.com" },
  });
  fireEvent.change(screen.getByLabelText("Seller’s Escrow sandbox email"), {
    target: { value: "seller@test.escrow.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create sandbox checkout" }));
  await screen.findByText("Unknown response; reconcile before retrying");
  fireEvent.click(screen.getByRole("button", { name: "Create sandbox checkout" }));
  await waitFor(() => expect(h.create).toHaveBeenCalledTimes(2));
  expect(h.create.mock.calls[0]![0].data.order.requestId).toBe(
    h.create.mock.calls[1]![0].data.order.requestId,
  );
});
