import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export type AccountNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};
const token = z.string().min(20).max(10000);
export const getNotifications = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, page: z.number().int().min(0).max(1000).default(0) }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [rows, count] = await Promise.all([
      db
        .from("account_notifications")
        .select("id,title,body,created_at,read_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(data.page * 20, data.page * 20 + 20),
      db
        .from("account_notifications")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
    if (rows.error || count.error) throw new Error("Notifications could not be loaded. Try again.");
    return {
      items: (rows.data ?? []).slice(0, 20) as AccountNotification[],
      unread: count.count ?? 0,
      hasMore: (rows.data?.length ?? 0) > 20,
      readThrough: data.page === 0 ? (rows.data?.[0]?.created_at ?? null) : null,
    };
  });
export const readNotifications = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token,
      target: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("one"), id: z.string().uuid() }),
        z.object({ kind: z.literal("all"), through: z.string().datetime({ offset: true }) }),
      ]),
    }),
  )
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    let query = db
      .from("account_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    query =
      data.target.kind === "one"
        ? query.eq("id", data.target.id)
        : query.lte("created_at", data.target.through);
    const r = await query;
    if (r.error) throw new Error("Notifications could not be marked as read. Try again.");
    return { ok: true };
  });
