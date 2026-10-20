import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { img } from "@/lib/images";
import { readListingImage } from "@/lib/listing-image-storage";

export function ListingImage({ image, alt, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { image: string }) {
  const [local, setLocal] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!image.startsWith("local-image:")) return;
    let alive = true;
    let url: string | undefined;
    void readListingImage(image.slice(12)).then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setLocal({ key: image, url });
    }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [image]);
  const src = image.startsWith("local-image:") ? (local?.key === image ? local.url : undefined) : img(image);
  if (!src) return <div role="img" aria-label={alt ?? "Image unavailable"} className={props.className + " bg-muted"} />;
  return <img {...props} alt={alt} src={src} />;
}