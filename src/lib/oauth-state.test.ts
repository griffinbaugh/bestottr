// @vitest-environment node
import { describe, it, expect } from "vitest";
import { newOAuthFlow, sealFlow, openFlow } from "./oauth-state.server";
const secret = "a sufficiently long secret used only in tests";
describe("Roblox OAuth browser binding", () => {
  it("roundtrips encrypted session binding without exposing the bearer token", async () => {
    const { flow, challenge } = await newOAuthFlow("private-bearer-token-for-test");
    const cookie = await sealFlow(flow, secret);
    expect(cookie).not.toContain(flow.token);
    expect(challenge).toHaveLength(43);
    expect(flow.verifier).not.toBe(challenge);
    expect(await openFlow(cookie, secret)).toEqual(flow);
  });
  it("rejects a changed cookie and a different secret", async () => {
    const { flow } = await newOAuthFlow("private-bearer-token-for-test");
    const cookie = await sealFlow(flow, secret);
    const changed = (cookie[0] === "A" ? "B" : "A") + cookie.slice(1);
    await expect(openFlow(changed, secret)).rejects.toThrow();
    await expect(openFlow(cookie, secret + "rotated")).rejects.toThrow();
  });
  it("rejects expired and overlong authorization windows", async () => {
    const { flow } = await newOAuthFlow("private-bearer-token-for-test");
    const cookie = await sealFlow(flow, secret);
    await expect(openFlow(cookie, secret, flow.expires + 1)).rejects.toThrow("Flow expired");
    const future = await sealFlow({ ...flow, expires: Date.now() + 3600_000 }, secret);
    await expect(openFlow(future, secret)).rejects.toThrow("Flow expired");
  });
});
