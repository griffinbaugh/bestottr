import type { GalleryImage } from "./gallery";

/** Durable browser-local media for the existing demo marketplace; swap this adapter for hosted storage when listings gain accounts. */
function openImages(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bestottr-listing-images", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Image storage is unavailable in this browser."));
  });
}
export async function uploadListingImage(file: File): Promise<GalleryImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");
  // Validate decoding before persisting; never store transient object URLs in listing state.
  const bitmap = await createImageBitmap(file);
  bitmap.close();
  const id = crypto.randomUUID();
  const db = await openImages();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    tx.objectStore("images").put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("Couldn't save the image. Check available browser storage."));
  }).finally(() => db.close());
  return { id, url: `local-image:${id}`, source: "custom", storageRef: id };
}
export async function readListingImage(id: string): Promise<Blob | undefined> {
  const db = await openImages();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction("images", "readonly").objectStore("images").get(id);
    request.onsuccess = () => { db.close(); resolve(request.result as Blob | undefined); };
    request.onerror = () => { db.close(); reject(new Error("Image unavailable")); };
  });
}