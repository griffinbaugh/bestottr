// Demo state can be enabled explicitly in development. Production is closed until
// real marketplace services are configured; a browser cannot enable money flows.
export const IS_DEMO =
  import.meta.env.MODE === "test" ||
  (import.meta.env.DEV && import.meta.env["VITE_DEMO_MODE"] === "true");
export function requireDemo() {
  if (!IS_DEMO) throw new Error("Trading is not open yet. No payment has been taken.");
}
