import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/escrow/sandbox/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSandboxWebhook } = await import("@/lib/escrow-webhook.server");
        return handleSandboxWebhook(request);
      },
    },
  },
});
