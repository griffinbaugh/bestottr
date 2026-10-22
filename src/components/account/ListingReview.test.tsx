import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { draft, review, details } from "@/test/listing-review-fixture";
import { reviewSummary } from "@/lib/listing-review";
const h = vi.hoisted(() => ({ submit: vi.fn(), act: vi.fn(), queue: vi.fn(), get: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ session: { access_token: "token" } }) }));
vi.mock("./AccountLayout", () => ({
  Message: ({ error, success }: { error?: string; success?: string }) => (
    <div>
      {error}
      {success}
    </div>
  ),
}));
vi.mock("@/lib/listing-review.functions", () => ({
  submitListingReview: h.submit,
  actOnListingReview: h.act,
  getAdminReviews: h.queue,
  getReviewDetails: h.get,
  downloadReviewFile: vi.fn(),
}));
import { ListingReviewPanel } from "./ListingReviewPanel";
import { ListingReviewAdmin } from "./ListingReviewAdmin";
beforeEach(() => {
  vi.resetAllMocks();
  h.submit.mockResolvedValue(reviewSummary({ ...review, state: "in_review" }));
  h.queue.mockResolvedValue({
    publicationEnabled: false,
    reviews: [reviewSummary(review)],
    hasMore: false,
  });
  h.get.mockResolvedValue(details);
});
it("requires rights confirmation and separate submission confirmation", async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<ListingReviewPanel token="token" draft={draft} onChanged={refresh} />);
  const submit = screen.getByRole("button", { name: "Submit saved listing for review" });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(submit);
  expect(h.submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm submission" }));
  await waitFor(() =>
    expect(h.submit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        draftId: draft.id,
        confirmRights: true,
        expectedUpdatedAt: draft.updated_at,
      }),
    }),
  );
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});
it("explains approved content is still private and withdraws using its version", async () => {
  render(
    <ListingReviewPanel
      token="token"
      draft={draft}
      review={reviewSummary(review)}
      onChanged={async () => {}}
    />,
  );
  expect(screen.getByText("Approved — not public")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Submit saved listing for review" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Withdraw to edit" }));
  expect(h.act).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm withdraw" }));
  await waitFor(() =>
    expect(h.act).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: review.version, action: "withdraw" }),
    }),
  );
});
it("disables admin publication while the launch control is off", async () => {
  render(<ListingReviewAdmin />);
  fireEvent.click(await screen.findByRole("button", { name: /Test project/ }));
  expect(await screen.findByRole("button", { name: "Publish listing" })).toBeDisabled();
  expect(h.act).not.toHaveBeenCalled();
});
it("requires a second admin confirmation before approving the frozen version", async () => {
  h.get.mockResolvedValue({
    ...details,
    review: reviewSummary({ ...review, state: "in_review", version: 1 }),
  });
  render(<ListingReviewAdmin />);
  fireEvent.click(await screen.findByRole("button", { name: /Test project/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Approve version" }));
  expect(h.act).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm approve" }));
  await waitFor(() =>
    expect(h.act).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "approve", version: 1 }),
    }),
  );
});
