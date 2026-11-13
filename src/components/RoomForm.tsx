"use client";

import { useState } from "react";
import type { Room } from "@/lib/api";
import { input } from "@/lib/ui";

export type RoomBody = {
  name: string;
  price: number;
  price_daily: number | null;
  price_yearly: number | null;
  length_m: number | null;
  width_m: number | null;
  bathroom: string | null;
  electricity: string | null;
  has_tv: boolean;
  has_wardrobe: boolean;
  wardrobe_size: string | null;
  wardrobe_has_hanger: boolean;
};

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const num = (v: string) => (v === "" ? null : Number(v));

type Props = {
  /** Kosong = kamar baru. Berisi = mengubah kamar yang sudah ada. */
  initial?: Room;
  title?: string;
  submitLabel: string;
  busy: boolean;
  /** Mengembalikan true kalau tersimpan; formulir kamar baru dikosongkan setelahnya. */
  onSubmit: (body: RoomBody) => Promise<boolean>;
  onCancel?: () => void;
};

export default function RoomForm({ initial, title, submitLabel, busy, onSubmit, onCancel }: Props) {
  const blank = {
    name: initial?.name ?? "",
    price: str(initial?.price),
    price_daily: str(initial?.price_daily),
    price_yearly: str(initial?.price_yearly),
    length_m: str(initial?.length_m),
    width_m: str(initial?.width_m),
    bathroom: initial?.bathroom ?? "",
    electricity: initial?.electricity ?? "",
    has_tv: initial?.has_tv ?? false,
    has_wardrobe: initial?.has_wardrobe ?? false,
    wardrobe_size: initial?.wardrobe_size ?? "",
    wardrobe_has_hanger: initial?.wardrobe_has_hanger ?? false,
  };
  const [r, setR] = useState(blank);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await onSubmit({
      name: r.name,
      price: Number(r.price),
      price_daily: num(r.price_daily),
      price_yearly: num(r.price_yearly),
      length_m: num(r.length_m),
      width_m: num(r.width_m),
      bathroom: r.bathroom || null,
      electricity: r.electricity || null,
      has_tv: r.has_tv,
      has_wardrobe: r.has_wardrobe,
      wardrobe_size: r.has_wardrobe && r.wardrobe_size ? r.wardrobe_size : null,
      wardrobe_has_hanger: r.has_wardrobe && r.wardrobe_has_hanger,
    });
    // Untuk kamar baru, blank sudah kosong semua.
    if (ok && !initial) setR(blank);
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border bg-slate-50 p-3">
      {title && <div className="text-sm font-medium">{title}</div>}
      <input required value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="Nama / tipe kamar" className={input} />
      <div className="grid grid-cols-3 gap-2">
        <input required type="number" min={0} value={r.price} onChange={(e) => setR({ ...r, price: e.target.value })} placeholder="Harga/bulan" className={input} />
        <input type="number" min={0} value={r.price_daily} onChange={(e) => setR({ ...r, price_daily: e.target.value })} placeholder="Harga/hari" className={input} />
        <input type="number" min={0} value={r.price_yearly} onChange={(e) => setR({ ...r, price_yearly: e.target.value })} placeholder="Harga/tahun" className={input} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="0.1" min={0} value={r.length_m} onChange={(e) => setR({ ...r, length_m: e.target.value })} placeholder="Panjang (m)" className={input} />
        <input type="number" step="0.1" min={0} value={r.width_m} onChange={(e) => setR({ ...r, width_m: e.target.value })} placeholder="Lebar (m)" className={input} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={r.bathroom} onChange={(e) => setR({ ...r, bathroom: e.target.value })} className={input}>
          <option value="">Kamar mandi...</option>
          <option value="inside">Kamar mandi dalam</option>
          <option value="outside">Kamar mandi luar</option>
        </select>
        <select value={r.electricity} onChange={(e) => setR({ ...r, electricity: e.target.value })} className={input}>
          <option value="">Listrik...</option>
          <option value="included">Sudah termasuk</option>
          <option value="separate">Bayar sendiri</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={r.has_tv} onChange={(e) => setR({ ...r, has_tv: e.target.checked })} /> TV</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={r.has_wardrobe} onChange={(e) => setR({ ...r, has_wardrobe: e.target.checked })} /> Lemari</label>
        {r.has_wardrobe && (
          <>
            <input value={r.wardrobe_size} onChange={(e) => setR({ ...r, wardrobe_size: e.target.value })} placeholder="mis. 2 pintu" className="rounded-lg border px-2 py-1 text-sm" />
            <label className="flex items-center gap-2"><input type="checkbox" checked={r.wardrobe_has_hanger} onChange={(e) => setR({ ...r, wardrobe_has_hanger: e.target.checked })} /> Ada gantungan</label>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-60">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Batal</button>}
      </div>
    </form>
  );
}
