import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/trustap/sandbox/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleTrustapSync } = await import("@/lib/trustap-webhook.server");
        return handleTrustapSync(request);
      },
    },
  },
});
