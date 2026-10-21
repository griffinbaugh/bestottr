import { afterEach, describe, it, expect, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("Production marketplace boundary", () => {
  it("does not seed sample listings or execute demo purchases in production", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEMO_MODE", "true");
    vi.resetModules();
    const mode = await import("./app-mode");
    expect(mode.IS_DEMO).toBe(false);
    expect(() => mode.requireDemo()).toThrow();
    const { getState, actions, hydrateStore } = await import("./store");
    localStorage.setItem(
      "bestottr-demo-v2",
      JSON.stringify({ listings: [{ title: "Old browser sample" }] }),
    );
    hydrateStore();
    expect(getState().listings).toHaveLength(0);
    expect(getState().deals).toHaveLength(0);
    expect(() => actions.connectRoblox()).toThrow();
    expect(() => actions.reset()).toThrow();
    actions.runMonitorTick();
    expect(getState().roblox.connected).toBe(false);
    localStorage.removeItem("bestottr-demo-v2");
  });
});
