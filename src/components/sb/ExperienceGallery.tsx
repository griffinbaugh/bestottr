import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GalleryImage } from "@/lib/gallery";
import { Button } from "./ui";
import { ListingImage } from "./ListingImage";
import { cn } from "@/lib/utils";

export function ExperienceGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const index = Math.min(active, Math.max(0, images.length - 1));
  const image = images[index];
  const move = (delta: number) => setActive((index + delta + images.length) % images.length);
  return <div className="space-y-3" aria-label="Experience image gallery">
    <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted" onTouchStart={(e) => setTouchStart(e.touches[0]?.clientX ?? null)} onTouchEnd={(e) => {
      const end = e.changedTouches[0]?.clientX;
      if (touchStart !== null && end !== undefined && Math.abs(end - touchStart) > 40 && images.length > 1) move(end < touchStart ? 1 : -1);
      setTouchStart(null);
    }}>
      {image && <ListingImage image={image.url} alt={`${title} — image ${index + 1}`} className="h-full w-full object-cover" />}
      {images.length > 1 && <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
        <Button variant="subtle" size="icon" aria-label="Previous image" title="Previous image" onClick={() => move(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <Button variant="subtle" size="icon" aria-label="Next image" title="Next image" onClick={() => move(1)}><ChevronRight className="h-5 w-5" /></Button>
      </div>}
    </div>
    {images.length > 1 && <div className="grid grid-cols-5 gap-2">
      {images.map((i, n) => <Button key={i.id} variant="ghost" aria-label={`Show image ${n + 1}`} aria-pressed={index === n} onClick={() => setActive(n)} className={cn("h-auto min-h-11 overflow-hidden border p-0", index === n ? "border-foreground" : "border-border")}><ListingImage image={i.url} alt={`${title} thumbnail ${n + 1}`} className="aspect-video w-full object-cover" /></Button>)}
    </div>}
  </div>;
}