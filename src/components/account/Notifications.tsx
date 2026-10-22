import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/sb/ui";
import {
  getNotifications,
  readNotifications,
  type AccountNotification,
} from "@/lib/notifications.functions";
function useNotifications(page = 0, poll = false) {
  const { session } = useAuth(),
    client = useQueryClient(),
    userId = session?.user.id,
    token = session?.access_token;
  const prefix = ["account-notifications", userId];
  const query = useQuery({
    queryKey: [...prefix, page],
    queryFn: () => getNotifications({ data: { token: token!, page } }),
    enabled: !!token && !!session?.user.email_confirmed_at,
    staleTime: 30_000,
    refetchInterval: poll ? 60_000 : false,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const mark = useMutation({
    mutationFn: (target: Parameters<typeof readNotifications>[0]["data"]["target"]) =>
      readNotifications({ data: { token: token!, target } }),
    onSuccess: () => client.invalidateQueries({ queryKey: prefix }),
  });
  return { query, mark };
}
function NotificationRows({
  items,
  busy,
  onRead,
  onNavigate,
}: {
  items: AccountNotification[];
  busy: boolean;
  onRead: (id: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="relative px-4 py-4">
          <Link
            to="/seller"
            className="block rounded-sm pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              if (!item.read_at) onRead(item.id);
              onNavigate?.();
            }}
          >
            <p
              className={
                item.read_at ? "text-sm font-medium text-muted-foreground" : "text-sm font-semibold"
              }
            >
              {item.title}
            </p>
            <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
              {item.body}
            </p>
            <time className="mt-2 block text-xs text-muted-foreground" dateTime={item.created_at}>
              {new Date(item.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </Link>
          {!item.read_at && (
            <>
              <span
                aria-hidden="true"
                className="absolute right-4 top-5 h-1.5 w-1.5 rounded-full bg-red-500"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => onRead(item.id)}
                className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
                aria-label={`Mark ${item.title} as read`}
              >
                Mark as read
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
export function NotificationBell() {
  const { session } = useAuth();
  if (!session?.user.email_confirmed_at) return null;
  return <BellContent key={session.user.id} />;
}
function BellContent() {
  const [open, setOpen] = useState(false),
    { query, mark } = useNotifications(0, true),
    unread = query.data?.unread ?? 0;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void query.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unread > 0 && (
            <span
              data-testid="notification-unread-dot"
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(360px,calc(100vw-24px))] overflow-hidden p-0"
        aria-label="Notifications"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unread > 0 && query.data?.readThrough && (
            <button
              type="button"
              title="Mark all as read"
              aria-label="Mark all notifications as read"
              disabled={mark.isPending}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => mark.mutate({ kind: "all", through: query.data!.readThrough! })}
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="max-h-[min(420px,65dvh)] overflow-y-auto overscroll-contain">
          {query.isPending ? (
            <p role="status" className="p-5 text-sm text-muted-foreground">
              Loading notifications…
            </p>
          ) : query.isError ? (
            <div className="p-4 text-sm">
              <p role="alert">{query.error.message}</p>
              <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          ) : query.data?.items.length ? (
            <NotificationRows
              items={query.data.items.slice(0, 6)}
              busy={mark.isPending}
              onRead={(id) => mark.mutate({ kind: "one", id })}
              onNavigate={() => setOpen(false)}
            />
          ) : (
            <div className="space-y-1 px-4 py-8 text-center">
              <p className="text-sm font-medium">You’re all caught up</p>
              <p className="text-xs text-muted-foreground">Listing updates will appear here.</p>
            </div>
          )}
        </div>
        {mark.isError && (
          <p role="alert" className="px-4 pb-3 text-xs text-destructive">
            {mark.error.message}
          </p>
        )}
        <Link
          to="/account/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-border px-4 py-3 text-center text-xs font-medium hover:bg-accent"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
export function NotificationInbox() {
  const { session } = useAuth();
  return <InboxContent key={session?.user.id} />;
}
function InboxContent() {
  const [page, setPage] = useState(0),
    { query, mark } = useNotifications(page),
    unread = query.data?.unread ?? 0;
  return (
    <section className="surface mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-semibold">Your notifications</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "Listing review and publication updates"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh
          </Button>
          {unread > 0 && query.data?.readThrough && (
            <Button
              variant="outline"
              size="sm"
              disabled={mark.isPending}
              onClick={() => mark.mutate({ kind: "all", through: query.data!.readThrough! })}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </div>
      {query.isPending ? (
        <p role="status" className="p-5 text-sm">
          Loading notifications…
        </p>
      ) : query.isError ? (
        <p role="alert" className="p-5 text-sm text-destructive">
          {query.error.message}
        </p>
      ) : query.data?.items.length ? (
        <NotificationRows
          items={query.data.items}
          busy={mark.isPending}
          onRead={(id) => mark.mutate({ kind: "one", id })}
        />
      ) : (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {page === 0
            ? "No notifications yet. Listing updates will appear here."
            : "No more notifications."}
        </p>
      )}
      {mark.isError && (
        <p role="alert" className="px-5 pb-3 text-sm text-destructive">
          {mark.error.message}
        </p>
      )}
      {(page > 0 || query.data?.hasMore) && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={query.isFetching || page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Newer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={query.isFetching || !query.data?.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
          </Button>
        </div>
      )}
    </section>
  );
}
