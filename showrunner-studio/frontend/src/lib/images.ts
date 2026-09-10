// images.ts — Local-first image handling. There is no storage backend, so an
// uploaded cover / portrait / set photo is downscaled in the browser and kept
// as a compressed data URL directly on the entity (ShowMeta.coverImage,
// CharacterEntity.portrait, SetEntity.image). That way images ride along in the
// existing JSON project export/import with no schema or index change, and never
// leave the browser.

/** Longest edge (px) an uploaded image is scaled down to before storing. */
export const MAX_IMAGE_DIM = 512;
/** Reject absurdly large source files before we even try to decode them. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // 25 MB
const QUALITY = 0.82;

export class ImageError extends Error {}

/** WebP encodes smaller and keeps alpha; fall back to JPEG where unsupported. */
function pickMime(): "image/webp" | "image/jpeg" {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    if (c.toDataURL("image/webp").startsWith("data:image/webp")) return "image/webp";
  } catch {
    /* ignore */
  }
  return "image/jpeg";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageError("That file couldn't be read as an image."));
    img.src = src;
  });
}

/**
 * Read a user-picked File, downscale it to fit within MAX_IMAGE_DIM (aspect
 * preserved, never upscaled) and return a compressed data URL suitable for
 * storing on an entity. Throws ImageError with a user-facing message on failure.
 */
export async function fileToStoredImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new ImageError("Pick an image file (PNG, JPG, WebP, GIF…).");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageError("That image is too large (max 25 MB). Try a smaller one.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new ImageError("That image appears to be empty.");

    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Your browser blocked image processing.");
    ctx.drawImage(img, 0, 0, outW, outH);

    const mime = pickMime();
    const dataUrl = canvas.toDataURL(mime, QUALITY);
    if (!dataUrl.startsWith("data:image/")) throw new ImageError("Couldn't encode that image.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
