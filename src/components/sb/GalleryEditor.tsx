import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { addGalleryImage, MAX_GALLERY_IMAGES, moveGalleryImage, type GalleryImage } from "@/lib/gallery";
import { uploadListingImage } from "@/lib/listing-image-storage";
import { ListingImage } from "./ListingImage";
import { Button } from "./ui";

export function GalleryEditor({ title, onTitleChange, images, onChange }: { title: string; onTitleChange: (title: string) => void; images: GalleryImage[]; onChange: (images: GalleryImage[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return <div className="space-y-6">
    <label className="block text-sm font-medium">Listing title<input aria-label="Listing title" className="field mt-1.5" value={title} maxLength={160} onChange={(e) => onTitleChange(e.target.value)} /></label>
    <div>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Listing images</h2><span className="num text-sm text-muted-foreground" aria-live="polite">{images.length} / 5</span></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {images.map((image, index) => <div key={image.id} className="overflow-hidden rounded-md border border-border">
          <div className="relative aspect-video bg-muted">
            <ListingImage image={image.url} alt={`Listing image ${index + 1}`} className="h-full w-full object-cover" />
            {index === 0 && <span className="absolute left-2 top-2 rounded bg-overlay px-2 py-1 text-xs text-overlay-foreground">Primary / cover</span>}
            <Button variant="subtle" size="icon" className="absolute right-2 top-2" aria-label={`Remove image ${index + 1}`} title="Remove image" onClick={() => onChange(images.filter((_, n) => n !== index))}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center justify-between gap-2 p-2"><span className="text-xs text-muted-foreground">{image.source === "roblox" ? "Imported from Roblox" : "Uploaded by you"}</span><div className="flex gap-1">
            <Button variant="ghost" size="icon" disabled={index === 0} title="Move earlier" aria-label={`Move image ${index + 1} earlier`} onClick={() => onChange(moveGalleryImage(images, index, index - 1))}><ArrowLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" disabled={index === images.length - 1} title="Move later" aria-label={`Move image ${index + 1} later`} onClick={() => onChange(moveGalleryImage(images, index, index + 1))}><ArrowRight className="h-4 w-4" /></Button>
          </div></div>
        </div>)}
        <Button variant="outline" disabled={busy || images.length >= MAX_GALLERY_IMAGES} className="min-h-32 border-dashed" onClick={() => input.current?.click()}><ImagePlus className="h-5 w-5" />{busy ? "Saving image…" : images.length >= 5 ? "5 image limit reached" : "Add image"}</Button>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload listing image" className="hidden" disabled={busy || images.length >= 5} onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || images.length >= 5) return;
        setBusy(true);
        try { onChange(addGalleryImage(images, await uploadListingImage(file))); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save this image."); } finally { setBusy(false); }
      }} />
      {!images.length && <p className="mt-3 text-sm text-muted-foreground">No Roblox thumbnails available. Add a cover image to continue.</p>}
    </div>
    <div className="border-t border-border pt-5"><div className="eyebrow mb-3">Marketplace preview</div><div className="max-w-sm overflow-hidden rounded-md border border-border">
      <div className="aspect-video bg-muted">{images[0] && <ListingImage image={images[0].url} alt="Marketplace cover preview" className="h-full w-full object-cover" />}</div>
      <div className="p-4"><div className="text-xs text-muted-foreground">Experience</div><h3 className="mt-1 break-words font-semibold">{title || "Listing title"}</h3></div>
    </div></div>
  </div>;
}