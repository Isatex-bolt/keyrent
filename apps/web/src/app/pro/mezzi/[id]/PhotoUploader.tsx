"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createUploadUrl, registerMedia } from "../../actions";

/** Carica le foto direttamente su Supabase Storage con un URL firmato dal server (niente limiti di dimensione del server). */
export function PhotoUploader({ listingId }: { listingId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage;
    let i = 0;
    for (const file of Array.from(files)) {
      i++;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError(`${file.name}: usa JPG, PNG o WEBP.`); continue; }
      if (file.size > 10 * 1024 * 1024) { setError(`${file.name}: massimo 10 MB.`); continue; }
      setBusy(`Caricamento ${i} di ${files.length}…`);
      try {
        const { path, token } = await createUploadUrl(listingId, file.name);
        const { error: upErr } = await storage.from("listings").uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (upErr) throw upErr;
        await registerMedia(listingId, path);
      } catch (e) {
        setError(`${file.name}: caricamento non riuscito.`);
        console.error(e);
      }
    }
    setBusy("");
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => input.current?.click()}>{busy || "+ Aggiungi foto"}</button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
