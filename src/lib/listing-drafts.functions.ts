import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { draftFields } from "./listing-drafts";
import { RobloxRateLimitError } from "./roblox-rate-limit";
import type { Database } from "@/integrations/supabase/types";
const token = z.string().min(20).max(10000);

export const getListingDrafts = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: drafts, error } = await supabaseAdmin
      .from("listing_drafts")
      .select("*")
      .eq("seller_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Your drafts could not be loaded. Please try again.");
    return drafts ?? [];
  });

export const saveListingDraft = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, draft: draftFields }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin
      .from("roblox_accounts")
      .select("roblox_user_id")
      .eq("user_id", user.id)
      .single();
    if (error || !link)
      return { ok: false as const, error: "Connect your Roblox account before saving a listing." };
    // Check existing ownership before doing external requests. Neither seller ID nor verification fields come from the browser.
    if (data.draft.id) {
      const { data: existing, error } = await supabaseAdmin
        .from("listing_drafts")
        .select("id")
        .eq("id", data.draft.id)
        .eq("seller_id", user.id)
        .maybeSingle();
      if (error || !existing)
        return { ok: false as const, error: "This draft could not be found." };
    }
    const { verifyListingDraftOwnership } = await import("./listing-draft-verifier.server");
    let identity;
    try {
      identity = await verifyListingDraftOwnership(
        data.draft.kind,
        data.draft.url,
        link.roblox_user_id,
      );
    } catch (e) {
      return {
        ok: false as const,
        retryAfterSeconds: e instanceof RobloxRateLimitError ? e.retryAfterSeconds : 0,
        error:
          e instanceof z.ZodError
            ? "Roblox returned incomplete information. Ownership could not be verified."
            : e instanceof Error
              ? e.message
              : "Ownership could not be checked. Please try again.",
      };
    }
    const d = data.draft;
    const row: Database["public"]["Tables"]["listing_drafts"]["Insert"] = {
      ...identity,
      seller_id: user.id,
      title: d.title,
      description: d.description,
      format: d.format,
      price_cents: d.priceCents,
      reserve_cents: d.format === "auction" ? d.reserveCents : null,
    };
    const query = d.id
      ? supabaseAdmin.from("listing_drafts").update(row).eq("id", d.id).eq("seller_id", user.id)
      : supabaseAdmin.from("listing_drafts").insert(row);
    const { data: saved, error: saveError } = await query.select("id").single();
    if (saveError || !saved)
      return {
        ok: false as const,
        error:
          saveError?.code === "23505"
            ? "You already have a draft for this asset. Open it below to make changes."
            : "Your draft could not be saved. Please try again.",
      };
    return { ok: true as const, id: saved.id };
  });

export const deleteListingDraft = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("listing_drafts")
      .delete()
      .eq("id", data.id)
      .eq("seller_id", user.id);
    if (error) throw new Error("Your draft could not be deleted. Please try again.");
    return { ok: true };
  });
