import { SANDBOX_ORIGIN, safeCheckoutUrl, type SandboxOrder } from "./escrow-sandbox";
export function sandboxConfig(env = process.env) {
  if (env["ESCROW_SANDBOX_ENABLED"] !== "true")
    throw new Error("Escrow sandbox is not enabled. No payment has been taken.");
  const email = env["ESCROW_SANDBOX_EMAIL"],
    key = env["ESCROW_SANDBOX_API_KEY"];
  if (!email || !key) throw new Error("Add the Escrow sandbox credentials to the Worker first.");
  return { email, key };
}
export function escrowSandboxClient(request: typeof fetch = fetch, config = sandboxConfig()) {
  const authorization = "Basic " + btoa(config.email + ":" + config.key);
  async function api(path: string, method: "GET" | "POST" = "GET", body?: unknown) {
    let r: Response;
    try {
      r = await request(SANDBOX_ORIGIN + path, {
        method,
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Error(
        "Escrow sandbox could not be reached. Check the order status before trying again.",
      );
    }
    if (!r.ok)
      throw new Error(
        `Escrow sandbox request failed (${r.status}). Check the sandbox account and transaction status.`,
      );
    return r.json() as Promise<unknown>;
  }
  return {
    create: async (order: SandboxOrder, returnUrl: string) => {
      if (
        [order.buyer_email.toLowerCase(), order.seller_email.toLowerCase()].includes(
          config.email.toLowerCase(),
        )
      )
        throw new Error("The sandbox broker must differ from the buyer and seller.");
      const result = await api("/integration/pay/2018-03-31", "POST", {
        currency: "usd",
        reference: order.reference,
        description: `BestOttr sandbox: ${order.title}`,
        return_url: returnUrl,
        redirect_type: "manual",
        parties: [
          { role: "broker", customer: "me" },
          { role: "buyer", customer: order.buyer_email, lock_email: true },
          { role: "seller", customer: order.seller_email },
        ],
        items: [
          {
            title: `[SANDBOX] ${order.title}`.slice(0, 100),
            description: "Test transfer only. No real funds or live purchase.",
            type: "general_merchandise",
            category: "computer_hardware_and_software",
            shipping_type: "no_shipping",
            quantity: 1,
            inspection_period: order.inspection_seconds,
            fees: [{ type: "escrow", payer_customer: order.buyer_email, split: "1" }],
            schedule: [
              {
                amount: (order.amount_cents / 100).toFixed(2),
                payer_customer: order.buyer_email,
                beneficiary_customer: order.seller_email,
              },
            ],
          },
        ],
      });
      return checkout(result);
    },
    recover: async (reference: string) =>
      checkout(await api("/integration/pay/2018-03-31?reference=" + encodeURIComponent(reference))),
    ensureWebhook: async (url: string) => {
      const current = (await api("/2017-09-01/customer/me/webhook")) as {
        webhooks?: { id: number; url: string }[];
      };
      if (!current || !Array.isArray(current.webhooks))
        throw new Error("Escrow returned an incomplete webhook list.");
      if (current.webhooks.some((w) => w.url === url)) return;
      const result = (await api("/2017-09-01/customer/me/webhook", "POST", { url })) as {
        id?: unknown;
      };
      if (!result || !Number.isSafeInteger(result.id))
        throw new Error("Webhook registration could not be confirmed.");
    },
    get: async (id: string) => {
      if (!/^[1-9]\d{0,18}$/.test(id)) throw new Error("Invalid transaction ID.");
      return api("/2017-09-01/transaction/" + id);
    },
  };
}
function checkout(value: unknown) {
  const v = value as { transaction_id?: unknown; landing_page?: unknown };
  if (
    !v ||
    !Number.isSafeInteger(v.transaction_id) ||
    Number(v.transaction_id) <= 0 ||
    typeof v.landing_page !== "string"
  )
    throw new Error(
      "Escrow returned an incomplete checkout. Reconcile this order before creating another.",
    );
  return { provider_id: String(v.transaction_id), checkout_url: safeCheckoutUrl(v.landing_page) };
}
