import { beforeEach, describe, expect, it } from "vitest";
import { actions, getState, normalizeState } from "@/lib/store";
import { seedState } from "@/lib/data";
import { dealStatus } from "@/lib/deal-status";
import { DEMO_USER_ID, findDemoProfile, profileUrlFor } from "@/lib/roblox";

const expDeal = () => {
  const l = getState().listings.find((x) => x.kind === "experience" && x.status === "live" && x.seller.handle !== "you")!;
  return actions.buyNow(l.id);
};
const target = (id: string, source: "connected" | "profile_url") => ({ ...findDemoProfile(id)!, profileUrl: profileUrlFor(id), source });
const acq = (id: string) => getState().deals.find((d) => d.id === id)!.acquisition!;

describe("acquisition store integration", () => {
  beforeEach(() => actions.reset());

  it("new Experience deals get an immutable asset identity; File deals get none", () => {
    const id = expDeal();
    const a = acq(id).asset;
    expect(a.placeId).toMatch(/^\d+$/);
    expect(a.universeId).toMatch(/^\d+$/);
    const file = getState().listings.find((x) => x.kind === "file" && x.format === "buy_now" && x.status === "live")!;
    const r = actions.buyFile(file.id);
    const fd = getState().deals.find((d) => d.id === r.dealId)!;
    expect(fd.acquisition).toBeUndefined();
    expect(fd.delivery.released).toBe(true);
  });

  it("connected account selection → confirm → fund locks target", () => {
    const id = expDeal();
    actions.connectRoblox();
    actions.selectTarget(id, target(DEMO_USER_ID, "connected"));
    expect(actions.fundExperienceDeal(id).ok).toBe(false);
    actions.confirmTarget(id);
    expect(actions.fundExperienceDeal(id).ok).toBe(true);
    expect(acq(id).targetLockedAt).not.toBeNull();
    expect(actions.selectTarget(id, target("55018342", "profile_url")).ok).toBe(false);
    expect(dealStatus(getState().deals.find((d) => d.id === id)!).label).toBe("Funds protected");
  });

  it("seller claim and ticks without transfer never pay; demo correct transfer pays exactly once", () => {
    const id = expDeal();
    actions.selectTarget(id, target("55018342", "profile_url"));
    actions.confirmTarget(id);
    actions.fundExperienceDeal(id);
    actions.sellerMarkTransferStarted(id);
    actions.runMonitorTick();
    expect(acq(id).payment.status).toBe("held");
    actions.demoSimulate(id, "wrong_user");
    actions.runMonitorTick();
    expect(acq(id).payment.status).toBe("held");
    actions.demoSimulate(id, "target");
    actions.runMonitorTick();
    actions.runMonitorTick();
    expect(acq(id).state).toBe("completed");
    expect(acq(id).payment.releaseCount).toBe(1);
  });

  it("demo fast-forward refunds exactly once", () => {
    const id = expDeal();
    actions.selectTarget(id, target("55018342", "profile_url"));
    actions.confirmTarget(id);
    actions.fundExperienceDeal(id);
    actions.demoSimulate(id, "expire");
    actions.runMonitorTick();
    expect(acq(id).state).toBe("refunded");
    expect(acq(id).payment.refundCount).toBe(1);
  });

  it("legacy funded Experience deals are normalized into a protected transfer", () => {
    const s = normalizeState(seedState(), Date.now());
    const d = s.deals.find((x) => x.id === "d-1042")!;
    expect(d.acquisition?.payment.status).toBe("held");
    expect(d.acquisition?.state).toBe("transfer_in_progress");
    expect(d.acquisition?.targetLockedAt).not.toBeNull();
  });
});
