import { createFileRoute, redirect } from "@tanstack/react-router";
// Preserve the former account bookmark while moving to Trustap.
export const Route = createFileRoute("/account_/escrow")({
  beforeLoad: () => {
    throw redirect({ to: "/account/payments" });
  },
});
