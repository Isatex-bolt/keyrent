"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createCatalogUploadUrl, saveCatalogImage } from "../actions";

export function CatalogUploader({ categoryId, modelId, hasImage }: { categoryId: string; modelId: string | null; hasImage: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("Usa JPG, PNG o WEBP."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Massimo 10 MB."); return; }
    setBusy(true);
    try {
      const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage;
      const { path, token } = await createCatalogUploadUrl(categoryId, modelId, file.name);
      const { error: e } = await storage.from("listings").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (e) throw e;
      await saveCatalogImage(categoryId, modelId, path);
      router.refresh();
    } catch (e) {
      console.error(e);
      setError("Caricamento non riuscito. Riprova.");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button type="button" className="btn-ghost px-3 py-2 text-sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Caricamento…" : hasImage ? "Sostituisci" : "Carica immagine"}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function CopyPrompt({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="text-sm font-semibold text-teal-600 hover:underline"
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}>
      {done ? "Copiato ✓" : "Copia testo per ChatGPT"}
    </button>
  );
}
