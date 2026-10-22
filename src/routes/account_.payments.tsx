import { createFileRoute } from "@tanstack/react-router";
import { TrustapSandbox } from "@/components/account/TrustapSandbox";
export const Route = createFileRoute("/account_/payments")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Payments — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: TrustapSandbox,
});
