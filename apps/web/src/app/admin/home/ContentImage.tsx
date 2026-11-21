"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createContentUploadUrl, generateContentImage, saveContentImage } from "../actions";

export function ContentImage({ kind, slug }: { kind: "collection" | "destination"; slug: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"" | "ai" | "up">("");
  const [err, setErr] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setErr("JPG, PNG o WEBP fino a 10 MB."); return; }
    setBusy("up"); setErr("");
    try {
      const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage;
      const { path, token } = await createContentUploadUrl(kind, slug, file.name);
      const { error } = await storage.from("listings").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw error;
      await saveContentImage(kind, slug, path);
      router.refresh();
    } catch { setErr("Caricamento non riuscito."); }
    setBusy("");
    if (input.current) input.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button type="button" className="btn-primary px-3 py-2 text-sm" disabled={!!busy}
        onClick={async () => {
          setBusy("ai"); setErr("");
          const r = await generateContentImage(kind, slug).catch(() => ({ error: "Errore, riprova." }));
          setBusy("");
          if ("error" in r && r.error) setErr(r.error); else router.refresh();
        }}>
        {busy === "ai" ? "Sto creando… (fino a 30 s)" : "✨ Crea con AI"}
      </button>
      <button type="button" className="btn-ghost px-3 py-2 text-sm" disabled={!!busy} onClick={() => input.current?.click()}>
        {busy === "up" ? "Caricamento…" : "Carica foto"}
      </button>
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
