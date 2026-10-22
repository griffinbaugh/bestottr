import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { trustapOrder } from "@/test/trustap-fixture";
import { draft, review } from "@/test/listing-review-fixture";
import { reviewSummary } from "@/lib/listing-review";
const h = vi.hoisted(() => ({ orders: vi.fn(), drafts: vi.fn(), reviews: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { id: string };
  }) => <a href={params ? to.replace("$id", params.id) : to}>{children}</a>,
}));
vi.mock("./AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: "buyer" }, access_token: "token" } }),
}));
vi.mock("./AccountLayout", () => ({
  RequireAccount: ({ children }: { children: ReactNode }) => <>{children}</>,
  Message: ({ error }: { error: string }) => <div>{error}</div>,
}));
vi.mock("@/lib/account-orders.functions", () => ({ getAccountOrders: h.orders }));
vi.mock("@/lib/listing-drafts.functions", () => ({ getListingDrafts: h.drafts }));
vi.mock("@/lib/listing-review.functions", () => ({ getSellerReviews: h.reviews }));
import { AccountOrdersDashboard } from "./AccountOrdersDashboard";
beforeEach(() => {
  vi.resetAllMocks();
  h.orders.mockResolvedValue({ orders: [trustapOrder], hasMore: false });
  h.drafts.mockResolvedValue([draft]);
  h.reviews.mockResolvedValue([reviewSummary(review)]);
});
it("shows buyer totals including fees and links the participant order", async () => {
  render(<AccountOrdersDashboard side="buying" />);
  expect(await screen.findByText("Test buyer total $52.90")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Test project/ })).toHaveAttribute(
    "href",
    "/deal/" + trustapOrder.id,
  );
  expect(h.drafts).not.toHaveBeenCalled();
  expect(h.reviews).not.toHaveBeenCalled();
  expect(screen.getByText(/do not represent real payments or revenue/)).toBeInTheDocument();
});
it("shows saved seller listings and separates private approvals from test proceeds", async () => {
  render(<AccountOrdersDashboard side="selling" />);
  expect(await screen.findByText(/Approved — not public/)).toBeInTheDocument();
  expect(screen.getByText("Test seller proceeds $50.00")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "View listing" })).not.toBeInTheDocument();
});
it("loads the next page instead of stopping at a fixed recent-order cap", async () => {
  h.orders.mockResolvedValue({ orders: [trustapOrder], hasMore: true });
  render(<AccountOrdersDashboard side="buying" />);
  await screen.findByText("Test buyer total $52.90");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(h.orders).toHaveBeenLastCalledWith({
      data: { token: "token", side: "buying", page: 1 },
    }),
  );
});
it("does not present a failed request as no purchases", async () => {
  h.orders.mockRejectedValue(new Error("Your orders could not be loaded."));
  render(<AccountOrdersDashboard side="buying" />);
  expect(await screen.findByText("Your orders could not be loaded.")).toBeInTheDocument();
  expect(screen.queryByText(/No test orders yet/)).not.toBeInTheDocument();
});
