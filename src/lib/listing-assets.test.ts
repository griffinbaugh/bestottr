import { describe, it, expect } from "vitest";
import { uploadFields, matchesImage } from "./listing-assets";
const base = {
  draftId: "aa000000-0000-4000-8000-000000000001",
  category: "image",
  filename: "cover.png",
  contentType: "image/png",
  size: 100,
};
describe("Private upload validation", () => {
  it("rejects active content, traversal, oversized and zero-byte images", () => {
    for (const patch of [
      { filename: "../cover.png" },
      { filename: "x\n.png" },
      { contentType: "image/svg+xml" },
      { contentType: "text/html" },
      { size: 5242881 },
      { size: 0 },
    ])
      expect(uploadFields.safeParse({ ...base, ...patch }).success).toBe(false);
  });
  it("allows only ZIP or Roblox deliverable names as attachments", () => {
    for (const filename of ["bundle.zip", "model.rbxm", "place.rbxl", "model.rbxmx", "place.rbxlx"])
      expect(
        uploadFields.safeParse({
          ...base,
          category: "file",
          filename,
          contentType: "application/octet-stream",
          size: 52428800,
        }).success,
      ).toBe(true);
    for (const filename of ["app.exe", "page.html", "bundle.zip.exe", "/bundle.zip"])
      expect(
        uploadFields.safeParse({
          ...base,
          category: "file",
          filename,
          contentType: "application/octet-stream",
        }).success,
      ).toBe(false);
  });
  it("does not trust an image MIME label without its corresponding signature", () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(matchesImage(png, "image/png")).toBe(true);
    expect(matchesImage(new TextEncoder().encode("<svg onload="), "image/png")).toBe(false);
    expect(matchesImage(png, "image/jpeg")).toBe(false);
    expect(matchesImage(new Uint8Array([255, 216, 255]), "image/jpeg")).toBe(true);
    expect(matchesImage(new TextEncoder().encode("RIFF0000WEBP"), "image/webp")).toBe(true);
  });
});
import { listingReadiness } from "./listing-readiness";
it("does not treat pending deliverables or past auction dates as publication ready", () => {
  const draft = {
    kind: "file" as const,
    url: "",
    title: "Model pack",
    description: "Included parts",
    format: "auction" as const,
    priceCents: 50,
    reserveCents: null,
    auctionEndsAt: 100,
  };
  const assets: any = [
    { category: "image", status: "ready" },
    { category: "file", status: "pending" },
  ];
  const checks = listingReadiness(draft, assets, 200);
  expect(checks.find((c) => c.label === "Deliverable file uploaded")?.done).toBe(false);
  expect(checks.find((c) => c.label === "Future auction closing time")?.done).toBe(false);
  expect(checks.find((c) => c.label === "All uploads completed")?.done).toBe(false);
});
