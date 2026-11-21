"use client";

/**
 * Prepara una foto per il caricamento: la ridimensiona (lato lungo max 2400 px) e la converte in JPEG.
 * Così anche le immagini PNG grandi (es. da ChatGPT) stanno sotto i limiti e la pagina resta veloce.
 */
export async function prepareImage(file: File, maxSide = 2400, quality = 0.86): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Il file non è un'immagine.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error("Formato immagine non supportato: usa JPG, PNG o WEBP."); }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function errorText(e: unknown) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
