import { useEffect, useState } from "react";
import { Button } from "@/components/sb/ui";
import { Message } from "./AccountLayout";
import { supabase } from "@/integrations/supabase/client";
import { bytesLabel, uploadFields, type AssetView } from "@/lib/listing-assets";
import {
  getDraftAssets,
  prepareDraftUpload,
  finishDraftUpload,
  deleteDraftUpload,
  setDraftCover,
  moveDraftImage,
  downloadDraftFile,
} from "@/lib/listing-assets.functions";
import { listingReadiness } from "@/lib/listing-readiness";
import { centsToDisplay } from "@/lib/currency";
import { formatAuctionEnd } from "@/lib/auction-end";
import type { DraftInput } from "@/lib/listing-drafts";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
export function DraftMedia({
  token,
  draft,
  coverId,
  onCoverChange,
}: {
  token: string;
  draft: DraftInput & { id: string };
  coverId: string | null;
  onCoverChange: (id: string | null) => void;
}) {
  const [assets, setAssets] = useState<AssetView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const images = assets.filter((a) => a.category === "image" && a.status === "ready");
  const checks = listingReadiness(draft, assets);
  const cover = images.find((a) => a.id === coverId) ?? images[0];
  const shown = images.find((a) => a.id === selected) ?? cover;
  async function refresh() {
    setAssets(await getDraftAssets({ data: { token, draftId: draft.id } }));
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    void getDraftAssets({ data: { token, draftId: draft.id } })
      .then((rows) => {
        if (active) setAssets(rows);
      })
      .catch(() => {
        if (active) setError("Uploads could not be loaded. Use Refresh uploads to retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, draft.id]);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "This request could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null, category: "image" | "file") {
    if (!files?.length) return;
    const picked = Array.from(files);
    await action(async () => {
      for (let i = 0; i < picked.length; i++) {
        const file = picked[i]!;
        setStatus(`Uploading ${i + 1} of ${picked.length}: ${file.name}`);
        const contentType = category === "image" ? file.type : "application/octet-stream";
        const validated = uploadFields.safeParse({
          draftId: draft.id,
          category,
          filename: file.name,
          contentType,
          size: file.size,
        });
        if (!validated.success)
          throw new Error(validated.error.issues[0]?.message ?? "Check the file size and type.");
        const slot = await prepareDraftUpload({ data: { token, upload: validated.data } });
        // Upload directly to private Storage; the Worker never proxies a 50 MB file.
        const result = await supabase.storage
          .from(slot.bucket)
          .uploadToSignedUrl(slot.path, slot.token, file, { contentType, cacheControl: "3600" });
        if (result.error)
          throw new Error("Upload failed. Remove the incomplete upload below and try again.");
        await finishDraftUpload({ data: { token, id: slot.id } });
      }
      setStatus("Uploads saved privately.");
    });
    // Show completed and incomplete uploads even when one member of a batch failed.
    try {
      await refresh();
    } catch {
      /* Preserve the actionable error above. */
    }
  }
  return (
    <section className="surface space-y-5 p-5 md:p-6" aria-label="Draft media and files">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Images & deliverables</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void action(refresh)}
        >
          Refresh uploads
        </Button>
      </div>
      <Message error={error} success={status} />
      {loading ? (
        <p role="status">Loading uploads…</p>
      ) : (
        <>
          <label className="block text-sm font-medium">
            Add listing images
            <input
              className="field mt-2"
              aria-label="Add listing images"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files, "image");
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Up to 8 PNG, JPEG or WebP images, 5 MB each. The selected cover appears first in your
            preview.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((item, index) => (
              <div key={item.id} className="min-w-0 rounded-md border border-border p-2">
                <img
                  src={item.url ?? undefined}
                  alt={item.filename}
                  className="aspect-video w-full rounded object-cover"
                  onError={(e) => {
                    e.currentTarget.style.opacity = "0.3";
                  }}
                />
                <p className="mt-2 truncate text-xs">{item.filename}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={cover?.id === item.id ? "primary" : "outline"}
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await setDraftCover({ data: { token, id: item.id } });
                        onCoverChange(item.id);
                      })
                    }
                  >
                    {cover?.id === item.id ? "Cover" : "Set cover"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Move ${item.filename} earlier`}
                    disabled={busy || index === 0}
                    onClick={() =>
                      void action(async () => {
                        await moveDraftImage({
                          data: { token, id: item.id, direction: "earlier" },
                        });
                      })
                    }
                  >
                    ←
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Move ${item.filename} later`}
                    disabled={busy || index === images.length - 1}
                    onClick={() =>
                      void action(async () => {
                        await moveDraftImage({ data: { token, id: item.id, direction: "later" } });
                      })
                    }
                  >
                    →
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setRemoveId(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <label className="block text-sm font-medium">
            Add deliverable files
            <input
              className="field mt-2"
              aria-label="Add deliverable files"
              type="file"
              multiple
              accept=".zip,.rbxm,.rbxl,.rbxmx,.rbxlx"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files, "file");
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Up to 3 ZIP or Roblox model/place files, 50 MB each. Only upload work you have the right
            to sell. Files remain private; checkout and buyer delivery are not open.
          </p>
          {assets
            .filter((a) => a.category === "file" || a.status === "pending")
            .map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 border-t border-border py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-all">{item.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {bytesLabel(item.size_bytes)} ·{" "}
                    {item.status === "pending"
                      ? "Incomplete upload"
                      : "Stored privately · not reviewed"}
                  </p>
                </div>
                {item.status === "pending" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await finishDraftUpload({ data: { token, id: item.id } });
                      })
                    }
                  >
                    Check upload
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const r = await downloadDraftFile({ data: { token, id: item.id } });
                        window.location.assign(r.url);
                      })
                    }
                  >
                    Download
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRemoveId(item.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          {removeId && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p>Remove this upload permanently?</p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await deleteDraftUpload({ data: { token, id: removeId } });
                      if (coverId === removeId) onCoverChange(null);
                      setRemoveId(null);
                    })
                  }
                >
                  Remove upload
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRemoveId(null)}
                >
                  Keep upload
                </Button>
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setSelected(cover?.id ?? null);
              setPreview(true);
            }}
          >
            Preview listing
          </Button>
        </>
      )}
      <div className="rounded-md border border-border p-4">
        <h3 className="font-medium">Before publication</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.label} className={c.done ? "text-foreground" : "text-muted-foreground"}>
              {c.done ? "✓" : "○"} {c.label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {checks.every((c) => c.done)
            ? "Your listing details are prepared. "
            : "Complete the remaining details above. "}
          Publication will open after checkout is connected. Experiences and communities will
          require a fresh ownership check when published.
        </p>
        <Button type="button" className="mt-3" disabled>
          Publish not open
        </Button>
      </div>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogTitle>{draft.title || "Untitled listing"}</DialogTitle>
          <DialogDescription>
            Private preview of your current edits. Save the draft to keep changes. Bids and checkout
            are closed.
          </DialogDescription>
          {shown?.url ? (
            <img
              src={shown.url}
              alt={shown.filename}
              className="max-h-96 w-full rounded-md object-contain"
            />
          ) : (
            <div className="grid aspect-video place-items-center rounded-md bg-secondary text-muted-foreground">
              Add listing images
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto">
            {[...(cover ? [cover] : []), ...images.filter((a) => a.id !== cover?.id)].map(
              (item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-label={`View ${item.filename}`}
                  onClick={() => setSelected(item.id)}
                  className={`shrink-0 rounded border p-1 ${shown?.id === item.id ? "border-foreground" : "border-border"}`}
                >
                  <img src={item.url ?? undefined} alt="" className="h-14 w-20 object-cover" />
                </button>
              ),
            )}
          </div>
          <p className="text-xl font-semibold">
            {centsToDisplay(draft.priceCents)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {draft.format === "auction" ? "starting bid" : "asking price"}
            </span>
          </p>
          {draft.format === "auction" && (
            <div className="text-sm">
              {draft.auctionEndsAt
                ? `Planned end: ${formatAuctionEnd(draft.auctionEndsAt)}`
                : "Choose an auction end before publication."}
              {draft.reserveCents != null && <p>A reserve price is set.</p>}
            </div>
          )}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {draft.description || "Add a description."}
          </p>
          <p className="text-xs text-muted-foreground">
            {assets.filter((a) => a.category === "file" && a.status === "ready").length} deliverable
            files prepared. Preview viewers do not receive file download links.
          </p>
          <Button type="button" disabled>
            Checkout not open
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
