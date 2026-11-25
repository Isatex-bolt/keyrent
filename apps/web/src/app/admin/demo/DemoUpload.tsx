"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createDemoUploadUrl, saveDemoUpload } from "./actions";
import { errorText, prepareImage } from "@/lib/prepareImage";

/** Carica la foto di un annuncio di esempio: sostituisce quelle che ci sono. */
export function DemoUpload({ listingId }: { listingId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(picked?: File) {
    if (!picked) return;
    setBusy(true); setErr("");
    try {
      const file = await prepareImage(picked);
      const prep = await createDemoUploadUrl(listingId, file.name);
      if ("error" in prep) throw new Error(prep.error);
      const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage;
      const { error } = await storage.from("listings").uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
      if (error) throw error;
      const saved = await saveDemoUpload(listingId, prep.path);
      if ("error" in saved) throw new Error(saved.error);
      router.refresh();
    } catch (e) {
      setErr(`Caricamento non riuscito: ${errorText(e)}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}
        className="w-full rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Carico…" : "Carica foto"}
      </button>
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}
