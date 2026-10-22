import { z } from "zod";
import {
  SANDBOX_ORIGIN,
  providerId,
  providerDescription,
  safeCheckoutUrl,
  type SandboxOrder,
} from "./trustap-sandbox";
export function sandboxConfig(env = process.env) {
  if (env["TRUSTAP_SANDBOX_ENABLED"] !== "true")
    throw new Error("Trustap sandbox is not enabled. No payment has been taken.");
  const key = env["TRUSTAP_SANDBOX_API_KEY"],
    clientId = env["TRUSTAP_CLIENT_ID"];
  if (!key?.startsWith("capi_test_") || !clientId)
    throw new Error("Configure the Trustap sandbox API key and client ID first.");
  return { key, clientId };
}
export function trustapSandboxClient(request: typeof fetch = fetch, config = sandboxConfig()) {
  async function api(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
    userId?: string,
  ) {
    let r: Response;
    try {
      r = await request(SANDBOX_ORIGIN + path, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: "Basic " + btoa(config.key + ":"),
          "Content-Type": "application/json",
          ...(userId ? { "Trustap-User": userId } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error(
        "Trustap could not be reached. Reconcile this order before retrying an action.",
      );
    }
    if (!r.ok)
      throw new Error(
        `Trustap sandbox request failed (${r.status}). Check the integration dashboard.`,
      );
    return r.json() as Promise<unknown>;
  }
  return {
    fees: async (amount: number) =>
      z
        .object({
          buyer: z.number().int().nonnegative().safe(),
          seller: z.number().int().nonnegative().safe(),
          config: z.number().int().nonnegative().safe(),
        })
        .parse(await api(`/v2/fees?currency=usd&amount=${amount}&payment_method=card`)),
    create: async (o: SandboxOrder) =>
      api(
        "/v2/transactions",
        "POST",
        {
          currency: "usd",
          amount: o.amount_cents,
          amount_extra: 0,
          contains_shipping: false,
          buyer_id: o.buyer_provider_id,
          seller_id: o.seller_provider_id,
          description: providerDescription(o),
          fees_buyer: o.fees_buyer,
          fees_seller: o.fees_seller,
          fees_config: o.fees_config,
          payment_method: "card",
          role: "seller",
        },
        o.seller_provider_id,
      ),
    get: (id: string) => api("/v2/transactions/" + providerId.parse(id)),
    acceptPayment: (o: SandboxOrder) =>
      api(
        `/v2/transactions/${providerId.parse(o.provider_id)}/accept_payment`,
        "POST",
        undefined,
        o.seller_provider_id,
      ),
    confirmDelivery: (o: SandboxOrder) =>
      api(
        `/v2/transactions/${providerId.parse(o.provider_id)}/confirm_delivery`,
        "POST",
        undefined,
        o.buyer_provider_id,
      ),
    checkout: (raw: string, id: string, returnUrl: string) => {
      const url = new URL(safeCheckoutUrl(raw, id));
      url.searchParams.set("redirect_uri", returnUrl);
      return url.href;
    },
  };
}
