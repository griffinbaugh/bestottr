import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SandboxOrder } from "./trustap-sandbox";
const token = z.string().min(20).max(10000);
export type AccountOrderSummary = Pick<
  SandboxOrder,
  | "id"
  | "title"
  | "kind"
  | "state"
  | "amount_cents"
  | "fees_buyer"
  | "fees_seller"
  | "created_at"
  | "checked_at"
>;
export const getAccountOrders = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token,
      side: z.enum(["buying", "selling"]),
      page: z.number().int().min(0).max(1000).default(0),
    }),
  )
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const rows = await db
      .from("trustap_sandbox_orders")
      .select("id,title,kind,state,amount_cents,fees_buyer,fees_seller,created_at,checked_at")
      .eq(data.side === "buying" ? "buyer_id" : "seller_id", user.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(data.page * 25, data.page * 25 + 25);
    if (rows.error) throw new Error("Your orders could not be loaded. Refresh to try again.");
    return {
      orders: (rows.data ?? []).slice(0, 25) as AccountOrderSummary[],
      hasMore: (rows.data?.length ?? 0) > 25,
    };
  });
export const getAccountOrder = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, orderView, sandboxAdmin } = await import("./trustap-sandbox.server");
    // Participant lookup precedes private files/history. Being an admin is not participant access.
    const order = await participantOrder(user.id, data.id);
    return { order: await orderView(order, user.id), admin: await sandboxAdmin(user.id) };
  });
