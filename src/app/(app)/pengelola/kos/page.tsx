"use client";

import Link from "@/components/Link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import KosForm, { type KosBody } from "@/components/KosForm";
import RoomForm, { type RoomBody } from "@/components/RoomForm";
import { api, type KosDetail, type Photo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupiah } from "@/lib/format";
import { input } from "@/lib/ui";

function Manage() {
  const id = useSearchParams().get("id");
  const { user, ready } = useAuth();
  const [kos, setKos] = useState<KosDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingKos, setEditingKos] = useState(false);
  const [editingRoom, setEditingRoom] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);
  const [photoRoom, setPhotoRoom] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<{ data: KosDetail }>(`/manager/kos/${id}`);
      setKos(res.data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // Memuat data saat halaman dibuka: setState baru dipanggil setelah await di dalam load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user?.is_manager) load();
  }, [user, load]);

  async function run(name: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (success) setNotice(success);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const addRoom = (body: RoomBody) => run("room", () => api(`/manager/kos/${id}/rooms`, { method: "POST", body }), "Kamar ditambahkan.");

  async function saveRoom(roomId: number, body: RoomBody) {
    const ok = await run("room-edit", () => api(`/manager/rooms/${roomId}`, { method: "PUT", body }), "Kamar diperbarui.");
    if (ok) setEditingRoom(null);
    return ok;
  }

  async function saveKos(body: KosBody) {
    const ok = await run("kos-edit", () => api(`/manager/kos/${id}`, { method: "PUT", body }), "Data kos diperbarui.");
    if (ok) setEditingKos(false);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!files || files.length === 0) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files[]", f));
    if (photoRoom) form.append("room_id", photoRoom);
    const ok = await run("photo", () => api(`/manager/kos/${id}/photos`, { method: "POST", form }), "Foto diunggah.");
    if (ok) {
      setFiles(null);
      (document.getElementById("photo-input") as HTMLInputElement | null)?.setAttribute("value", "");
    }
  }

  if (!id) return <div className="p-6 text-sm">Kos tidak dipilih. <Link href="/pengelola/" className="text-brand underline">Kembali</Link></div>;
  if (!ready) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;
  if (!user?.is_manager) return <div className="p-6 text-sm"><Link href="/pengelola/" className="text-brand underline">Daftar sebagai pengelola</Link> dulu.</div>;
  if (!kos) return <div className="p-6 text-sm">{error ?? "Memuat..."}</div>;

  const allPhotos: { photo: Photo; label: string }[] = [
    ...kos.photos.map((p) => ({ photo: p, label: "Umum" })),
    ...kos.rooms.flatMap((r) => (r.photos ?? []).map((p) => ({ photo: p, label: r.name }))),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4 pb-12">
      <Link href="/pengelola/" className="text-sm text-brand">← Kembali</Link>

      <div className="space-y-1">
        <h1 className="text-xl font-bold">{kos.name}</h1>
        <div className="text-sm text-slate-600">{kos.address}</div>
        {kos.is_verified ? (
          <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Terverifikasi: tampil di pencarian</span>
        ) : (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Menunggu verifikasi admin. Kos belum tampil di pencarian. Lengkapi kamar dan foto supaya cepat disetujui.
          </div>
        )}
      </div>

      {notice && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Data kos</h2>
          <button onClick={() => setEditingKos((v) => !v)} className="rounded-full border px-3 py-1 text-xs">{editingKos ? "Batal" : "Ubah data kos"}</button>
        </div>
        {editingKos && (
          <div className="rounded-xl border bg-white p-3">
            <KosForm initial={kos} submitLabel="Simpan perubahan" busy={busy === "kos-edit"} onSubmit={saveKos} />
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Kamar</h2>
        {kos.rooms.length === 0 && <p className="text-sm text-slate-500">Belum ada kamar. Tambahkan minimal satu.</p>}
        {kos.rooms.map((r) =>
          editingRoom === r.id ? (
            <RoomForm key={r.id} initial={r} title={`Ubah kamar ${r.name}`} submitLabel="Simpan perubahan" busy={busy === "room-edit"} onSubmit={(body) => saveRoom(r.id, body)} onCancel={() => setEditingRoom(null)} />
          ) : (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.name}</div>
                <div className="text-xs text-slate-500">{rupiah(r.price)}/bln{r.area_m2 ? ` · ${r.area_m2} m²` : ""}{r.bathroom_label ? ` · ${r.bathroom_label}` : ""}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => run("status", () => api(`/manager/rooms/${r.id}/status`, { method: "PATCH", body: { status: r.is_available ? "occupied" : "available" } }))}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${r.is_available ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}
                >
                  {r.is_available ? "Kosong" : "Terisi"}
                </button>
                <button onClick={() => setEditingRoom(r.id)} className="rounded-full border px-2.5 py-1 text-xs">Ubah</button>
                <button onClick={() => confirm(`Hapus kamar ${r.name}?`) && run("del", () => api(`/manager/rooms/${r.id}`, { method: "DELETE" }), "Kamar dihapus.")} className="rounded-full border px-2.5 py-1 text-xs text-red-700">Hapus</button>
              </div>
            </div>
          ),
        )}

        <RoomForm title="Tambah kamar" submitLabel="Tambah kamar" busy={busy === "room"} onSubmit={addRoom} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Foto</h2>
        <form onSubmit={upload} className="space-y-2 rounded-xl border bg-slate-50 p-3">
          <input id="photo-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setFiles(e.target.files)} className="w-full text-xs" />
          <select value={photoRoom} onChange={(e) => setPhotoRoom(e.target.value)} className={input}>
            <option value="">Foto umum kos (tampak depan, area bersama)</option>
            {kos.rooms.map((r) => <option key={r.id} value={r.id}>Foto kamar: {r.name}</option>)}
          </select>
          <button disabled={busy === "photo" || !files?.length} className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-50">{busy === "photo" ? "Mengunggah..." : "Unggah foto"}</button>
          <p className="text-xs text-slate-500">JPEG, PNG, atau WebP. Foto dikompres otomatis. Hindari foto yang memperlihatkan papan nama atau nomor rumah.</p>
        </form>
        <div className="grid grid-cols-3 gap-2">
          {allPhotos.map(({ photo, label }) => (
            <div key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumbnail_url} alt="" className="h-24 w-full rounded-lg object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{label}</span>
              <button onClick={() => confirm("Hapus foto ini?") && run("delphoto", () => api(`/manager/photos/${photo.id}`, { method: "DELETE" }))} className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs text-red-700" aria-label="Hapus foto">✕</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function ManageKosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat...</div>}>
      <Manage />
    </Suspense>
  );
}
