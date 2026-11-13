"use client";

import Link from "@/components/Link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import KosForm, { type KosBody } from "@/components/KosForm";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function NewKosPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(body: KosBody) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ data: { id: number } }>("/manager/kos", { method: "POST", body });
      router.push(`/pengelola/kos/?id=${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan kos.");
      setBusy(false);
    }
  }

  if (!ready) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;
  if (!user?.is_manager) return <div className="p-6 text-sm"><Link href="/pengelola/" className="text-brand underline">Daftar sebagai pengelola</Link> dulu.</div>;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-12">
      <Link href="/pengelola/" className="text-sm text-brand">← Kembali</Link>
      <h1 className="text-xl font-bold">Pasang kos</h1>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <KosForm submitLabel="Simpan dan lanjut ke kamar" busy={busy} onSubmit={submit} />
    </div>
  );
}
