import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
const h = vi.hoisted(() => ({
  get: vi.fn(),
  read: vi.fn(),
  session: { user: { id: "seller", email_confirmed_at: "confirmed" }, access_token: "token" } as {
    user: { id: string; email_confirmed_at: string };
    access_token: string;
  } | null,
}));
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ session: h.session }) }));
vi.mock("@/lib/notifications.functions", () => ({
  getNotifications: h.get,
  readNotifications: h.read,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
    className,
  }: {
    children: ReactNode;
    to: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className={className}
    >
      {children}
    </a>
  ),
}));
import { NotificationBell, NotificationInbox } from "./Notifications";
const item = {
  id: "d3000000-0000-4000-8000-000000000001",
  title: "Listing approved",
  body: "Egg Fusion was approved. It remains private.",
  created_at: "2026-10-22T12:00:00Z",
  read_at: null,
};
let client: QueryClient;
function view(children: ReactNode) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  h.session = { user: { id: "seller", email_confirmed_at: "confirmed" }, access_token: "token" };
  h.get.mockResolvedValue({
    items: [item],
    unread: 1,
    hasMore: false,
    readThrough: item.created_at,
  });
  h.read.mockResolvedValue({ ok: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  client?.clear();
  vi.unstubAllGlobals();
});
it("shows a red dot for unread notifications and does not mark them just by opening", async () => {
  view(<NotificationBell />);
  await screen.findByRole("button", { name: "Notifications, 1 unread" });
  expect(screen.getByTestId("notification-unread-dot")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
  expect(await screen.findByText(item.body)).toBeInTheDocument();
  expect(h.read).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByText(item.body)).not.toBeInTheDocument());
});
it("marks one notification and clears the dot after the server confirms", async () => {
  h.read.mockImplementation(async () => {
    h.get.mockResolvedValue({
      items: [{ ...item, read_at: item.created_at }],
      unread: 0,
      hasMore: false,
      readThrough: item.created_at,
    });
    return { ok: true };
  });
  view(<NotificationBell />);
  fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mark Listing approved as read" }));
  await waitFor(() =>
    expect(screen.queryByTestId("notification-unread-dot")).not.toBeInTheDocument(),
  );
  expect(h.read).toHaveBeenCalledWith({
    data: { token: "token", target: { kind: "one", id: item.id } },
  });
});
it("marks all current notifications with the fetched cutoff", async () => {
  view(<NotificationBell />);
  fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mark all notifications as read" }));
  await waitFor(() =>
    expect(h.read).toHaveBeenCalledWith({
      data: { token: "token", target: { kind: "all", through: item.created_at } },
    }),
  );
});
it("hides the bell when signed out without querying private data", () => {
  h.session = null;
  view(<NotificationBell />);
  expect(screen.queryByRole("button", { name: /Notifications/ })).not.toBeInTheDocument();
  expect(h.get).not.toHaveBeenCalled();
});
it("never reuses another signed-in account's cached notifications", async () => {
  const tree = view(<NotificationBell />);
  await screen.findByRole("button", { name: "Notifications, 1 unread" });
  h.session = {
    user: { id: "other", email_confirmed_at: "confirmed" },
    access_token: "other-token",
  };
  h.get.mockResolvedValue({ items: [], unread: 0, hasMore: false, readThrough: null });
  tree.rerender(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.queryByTestId("notification-unread-dot")).not.toBeInTheDocument(),
  );
  expect(h.get).toHaveBeenLastCalledWith({ data: { token: "other-token", page: 0 } });
});
it("shows a failure rather than the empty inbox message", async () => {
  h.get.mockRejectedValue(new Error("Notifications could not be loaded."));
  view(<NotificationBell />);
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  expect(screen.queryByText("You’re all caught up")).not.toBeInTheDocument();
});
it("keeps the red dot on a failed read update", async () => {
  h.read.mockRejectedValue(new Error("Could not mark as read"));
  view(<NotificationBell />);
  fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mark Listing approved as read" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not mark as read");
  expect(screen.getByTestId("notification-unread-dot")).toBeInTheDocument();
});
it("provides older inbox pages and a link to manage listings", async () => {
  h.get.mockResolvedValue({
    items: [item],
    unread: 1,
    hasMore: true,
    readThrough: item.created_at,
  });
  view(<NotificationInbox />);
  await screen.findByText(item.body);
  expect(screen.getByRole("link", { name: /Listing approved/ })).toHaveAttribute("href", "/seller");
  fireEvent.click(screen.getByRole("button", { name: "Older" }));
  await waitFor(() =>
    expect(h.get).toHaveBeenLastCalledWith({ data: { token: "token", page: 1 } }),
  );
});
