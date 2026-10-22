import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/trustap/sandbox/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleTrustapWebhook } = await import("@/lib/trustap-webhook.server");
        return handleTrustapWebhook(request);
      },
    },
  },
});
