import { createFileRoute } from "@tanstack/react-router";
import { EscrowSandbox } from "@/components/account/EscrowSandbox";
export const Route = createFileRoute("/account_/escrow")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Escrow sandbox — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: EscrowSandbox,
});
