import { Blob as NodeBlob } from "node:buffer";
import { editableDraft } from "./listing-review.server";
vi.mock("./listing-review.server", () => ({ editableDraft: vi.fn() }));
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  user: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  signed: vi.fn(),
  upload: vi.fn(),
  info: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  filters: [] as unknown[][],
  asset: true,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (schema: any) => ({
      handler: (fn: any) => (args: any) => fn({ data: schema.parse(args.data) }),
    }),
  }),
}));
vi.mock("./account.server", () => ({ verifiedAccount: h.user }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: h.from,
    rpc: h.rpc,
    storage: {
      from: () => ({
        createSignedUrl: h.signed,
        createSignedUploadUrl: h.upload,
        info: h.info,
        download: h.download,
        remove: h.remove,
      }),
    },
  },
}));
import {
  getDraftAssets,
  prepareDraftUpload,
  finishDraftUpload,
  setDraftCover,
  downloadDraftFile,
} from "./listing-assets.functions";
const token = "qa-not-a-real-session-token";
const id = "aa000000-0000-4000-8000-000000000001";
const draftId = "bb000000-0000-4000-8000-000000000002";
const item = {
  id,
  draft_id: draftId,
  seller_id: "seller",
  category: "image",
  filename: "Cover.png",
  content_type: "image/png",
  size_bytes: 12,
  path: "seller/draft/image",
  status: "ready",
  position: 0,
  created_at: "2026-10-21",
};
let asset: any;
beforeEach(() => {
  vi.clearAllMocks();
  h.filters = [];
  h.asset = true;
  asset = { ...item };
  h.user.mockResolvedValue({ id: "seller" });
  h.from.mockImplementation((table: string) => {
    const b: any = {
      select: () => b,
      eq: (...filter: unknown[]) => {
        h.filters.push(filter);
        return b;
      },
      order: () => b,
      update: (v: any) => {
        h.update(v);
        return b;
      },
      delete: () => b,
      maybeSingle: async () => ({
        data:
          table === "listing_drafts"
            ? { id: draftId, cover_asset_id: null }
            : h.asset
              ? asset
              : null,
        error: null,
      }),
      then: (resolve: any) => Promise.resolve({ data: [asset], error: null }).then(resolve),
    };
    return b;
  });
  h.rpc.mockResolvedValue({ data: asset, error: null });
  h.signed.mockResolvedValue({
    data: { signedUrl: "https://storage.example/signed" },
    error: null,
  });
  h.upload.mockResolvedValue({ data: { token: "scoped-upload-token" }, error: null });
  h.info.mockResolvedValue({ data: { size: 12, contentType: "image/png" }, error: null });
  h.remove.mockResolvedValue({ error: null });
});
it("rejects unauthenticated media operations before privileged storage access", async () => {
  h.user.mockRejectedValue(new Error("Sign in first"));
  await expect(
    prepareDraftUpload({
      data: {
        token,
        upload: {
          draftId,
          category: "image",
          filename: "a.png",
          contentType: "image/png",
          size: 12,
        },
      },
    }),
  ).rejects.toThrow("Sign in");
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.upload).not.toHaveBeenCalled();
});
it("derives reservation seller from verified identity and forbids overwrite", async () => {
  await prepareDraftUpload({
    data: {
      token,
      upload: {
        draftId,
        category: "image",
        filename: "a.png",
        contentType: "image/png",
        size: 12,
        seller_id: "attacker",
      } as any,
    },
  });
  expect(h.rpc).toHaveBeenCalledWith(
    "reserve_listing_asset",
    expect.objectContaining({ p_seller: "seller", p_draft: draftId }),
  );
  expect(h.upload).toHaveBeenCalledWith(asset.path, { upsert: false });
});
it("never signs a download or cover operation for another seller's asset", async () => {
  h.asset = false;
  await expect(downloadDraftFile({ data: { token, id } })).rejects.toThrow("could not be found");
  await expect(setDraftCover({ data: { token, id } })).rejects.toThrow("could not be found");
  expect(h.filters).toContainEqual(["seller_id", "seller"]);
  expect(h.signed).not.toHaveBeenCalled();
  expect(h.update).not.toHaveBeenCalled();
});
it("returns image previews but no delivery-file or pending-upload URL", async () => {
  asset.category = "file";
  expect((await getDraftAssets({ data: { token, draftId } }))[0]).toMatchObject({ url: null });
  expect(h.signed).not.toHaveBeenCalled();
  asset.category = "image";
  asset.status = "pending";
  expect((await getDraftAssets({ data: { token, draftId } }))[0]).toMatchObject({ url: null });
  asset.status = "ready";
  const result = await getDraftAssets({ data: { token, draftId } });
  expect(result[0]).not.toHaveProperty("path");
  expect(result[0]).not.toHaveProperty("seller_id");
  expect(h.signed).toHaveBeenCalledWith(item.path, 3600);
});
it("rejects pending files and limits seller downloads to short-lived attachments", async () => {
  asset.category = "file";
  asset.status = "pending";
  await expect(downloadDraftFile({ data: { token, id } })).rejects.toThrow("not ready");
  expect(h.signed).not.toHaveBeenCalled();
  asset.status = "ready";
  asset.filename = "model.rbxm";
  await downloadDraftFile({ data: { token, id } });
  expect(h.signed).toHaveBeenCalledWith(item.path, 60, { download: "model.rbxm" });
});
it("does not permit a file or incomplete image as cover", async () => {
  asset.status = "pending";
  await expect(setDraftCover({ data: { token, id } })).rejects.toThrow("completed image");
  asset.status = "ready";
  asset.category = "file";
  await expect(setDraftCover({ data: { token, id } })).rejects.toThrow("completed image");
  expect(h.update).not.toHaveBeenCalled();
});
it("rejects mismatched uploaded size and never marks it ready", async () => {
  asset.status = "pending";
  h.info.mockResolvedValue({ data: { size: 999, contentType: "image/png" }, error: null });
  await expect(finishDraftUpload({ data: { token, id } })).rejects.toThrow("did not match");
  expect(h.remove).toHaveBeenCalledWith([item.path]);
  expect(h.update).not.toHaveBeenCalled();
});
it("checks image bytes before attaching a pending image", async () => {
  asset.status = "pending";
  h.download.mockResolvedValue({ data: new NodeBlob(["<svg bad!!!>"]), error: null });
  await expect(finishDraftUpload({ data: { token, id } })).rejects.toThrow("valid PNG");
  expect(h.update).not.toHaveBeenCalled();
  h.download.mockResolvedValue({
    data: new NodeBlob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])]),
    error: null,
  });
  await finishDraftUpload({ data: { token, id } });
  expect(h.update).toHaveBeenCalledWith({ status: "ready" });
});

it("blocks signed uploads while a draft is frozen for review", async () => {
  vi.mocked(editableDraft).mockRejectedValueOnce(new Error("Withdraw first"));
  await expect(
    prepareDraftUpload({
      data: {
        token,
        upload: {
          draftId,
          category: "image",
          filename: "cover.png",
          contentType: "image/png",
          size: 100,
        },
      },
    }),
  ).rejects.toThrow("Withdraw first");
  expect(h.upload).not.toHaveBeenCalled();
  expect(h.rpc).not.toHaveBeenCalled();
});
