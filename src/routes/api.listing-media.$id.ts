import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
export const Route = createFileRoute("/api/listing-media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!z.string().uuid().safeParse(params.id).success)
          return new Response(null, { status: 404 });
        const { publicImage } = await import("@/lib/listing-review.server");
        return publicImage(params.id);
      },
    },
  },
});
