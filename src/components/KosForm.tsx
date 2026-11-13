"use client";

import { useCallback, useState } from "react";
import KosMap from "@/components/KosMap";
import type { KosDetail } from "@/lib/api";
import { input } from "@/lib/ui";

export const START_POINT: [number, number] = [-8.6478, 115.1385];

/** Sama dengan RELOCATION_THRESHOLD_M di backend (Manager/KosController): lebih jauh dari ini, kos diverifikasi ulang. */
const RELOCATION_THRESHOLD_M = 200;

export type KosBody = {
  name: string;
  listed_by: string;
  property_type: string;
  resident_type: string;
  is_sharia: boolean;
  curfew_time: string | null;
  parking_motorcycle: boolean;
  parking_car: boolean;
  bicycle_inside: boolean;
  has_laundry_area: boolean;
  address: string;
  public_area: string;
  latitude: number;
  longitude: number;
  description: string | null;
};

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function distanceM(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

type Props = {
  /** Kosong = kos baru. Berisi = mengubah kos yang sudah ada. */
  initial?: KosDetail;
  submitLabel: string;
  busyLabel?: string;
  busy: boolean;
  onSubmit: (body: KosBody) => void;
};

export default function KosForm({ initial, submitLabel, busyLabel = "Menyimpan...", busy, onSubmit }: Props) {
  const startPin: [number, number] = initial ? [initial.latitude, initial.longitude] : START_POINT;
  const [pin, setPin] = useState<[number, number]>(startPin);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    listed_by: initial?.listed_by ?? "owner",
    property_type: initial?.property_type ?? "kos",
    resident_type: initial?.resident_type ?? "putri",
    is_sharia: initial?.is_sharia ?? false,
    open24: initial ? initial.curfew_time === null : true,
    curfew_time: initial?.curfew_time ?? "22:00",
    parking_motorcycle: initial?.parking_motorcycle ?? true,
    parking_car: initial?.parking_car ?? false,
    bicycle_inside: initial?.bicycle_inside ?? false,
    has_laundry_area: initial?.has_laundry_area ?? false,
    address: initial?.address ?? "",
    public_area: initial?.public_area ?? "",
    description: initial?.description ?? "",
  });

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const movePin = useCallback((lat: number, lng: number) => setPin([Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6]), []);

  function locate() {
    setGeoError(null);
    navigator.geolocation?.getCurrentPosition(
      (p) => movePin(p.coords.latitude, p.coords.longitude),
      () => setGeoError("Lokasi tidak diizinkan. Ketuk peta untuk menaruh pin."),
    );
  }

  // Peringatan hanya berarti untuk kos yang sudah lolos verifikasi: kos baru memang belum diverifikasi.
  const moved = initial ? distanceM(startPin, pin) : 0;
  const willReverify = !!initial?.is_verified && moved > RELOCATION_THRESHOLD_M;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: f.name,
      listed_by: f.listed_by,
      property_type: f.property_type,
      resident_type: f.resident_type,
      is_sharia: f.is_sharia,
      curfew_time: f.open24 ? null : f.curfew_time,
      parking_motorcycle: f.parking_motorcycle,
      parking_car: f.parking_car,
      bicycle_inside: f.bicycle_inside,
      has_laundry_area: f.has_laundry_area,
      address: f.address,
      public_area: f.public_area,
      latitude: pin[0],
      longitude: pin[1],
      description: f.description || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Nama kos</span>
        <input required value={f.name} onChange={(e) => set("name", e.target.value)} className={input} placeholder="mis. Kos Melati" />
        <span className="text-xs text-slate-500">Nama ini hanya tampil ke pelanggan setelah PO dibayar.</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Kamu adalah</span>
          <select value={f.listed_by} onChange={(e) => set("listed_by", e.target.value)} className={input}>
            <option value="owner">Pemilik kos</option>
            <option value="resident">Penghuni / pengelola</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Jenis</span>
          <select value={f.property_type} onChange={(e) => set("property_type", e.target.value)} className={input}>
            <option value="kos">Kos</option>
            <option value="kontrakan">Kontrakan</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Untuk penghuni</span>
          <select value={f.resident_type} onChange={(e) => set("resident_type", e.target.value)} className={input}>
            <option value="putri">Putri</option>
            <option value="putra">Putra</option>
            <option value="campur">Putra-putri</option>
          </select>
        </label>
      </div>

      <div className="space-y-2 rounded-xl border bg-white p-3">
        <div className="text-sm font-medium">Aturan dan fasilitas umum</div>
        <Check label="Syariah (sesama jenis sekamar; pasangan wajib bukti nikah)" checked={f.is_sharia} onChange={(v) => set("is_sharia", v)} />
        <Check label="Bebas 24 jam (tanpa jam malam)" checked={f.open24} onChange={(v) => set("open24", v)} />
        {!f.open24 && (
          <label className="flex items-center gap-2 text-sm">Jam malam <input type="time" value={f.curfew_time} onChange={(e) => set("curfew_time", e.target.value)} className="rounded-lg border px-2 py-1" /></label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Check label="Parkir motor" checked={f.parking_motorcycle} onChange={(v) => set("parking_motorcycle", v)} />
          <Check label="Parkir mobil" checked={f.parking_car} onChange={(v) => set("parking_car", v)} />
          <Check label="Sepeda boleh masuk" checked={f.bicycle_inside} onChange={(v) => set("bicycle_inside", v)} />
          <Check label="Tempat cuci baju" checked={f.has_laundry_area} onChange={(v) => set("has_laundry_area", v)} />
        </div>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Alamat lengkap</span>
        <textarea required value={f.address} onChange={(e) => set("address", e.target.value)} rows={2} className={input} placeholder="Jl. ..., No. ..., Kelurahan, Kecamatan" />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Area untuk publik</span>
        <input required maxLength={150} value={f.public_area} onChange={(e) => set("public_area", e.target.value)} className={input} placeholder="mis. Jalan Tukad Badung, Denpasar" />
        <span className="text-xs text-slate-500">Tampil ke pencari sebelum PO dibayar. Jangan tulis nomor rumah atau nama kos.</span>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Titik di peta</span>
          <button type="button" onClick={locate} className="rounded-lg border px-2.5 py-1 text-xs hover:bg-slate-50">📍 Pakai lokasi saya</button>
        </div>
        {geoError && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{geoError}</div>}
        <div className="h-64 overflow-hidden rounded-xl border">
          <KosMap center={startPin} zoom={initial ? 17 : 13} pin={pin} onPinChange={movePin} clickToPlacePin />
        </div>
        <p className="text-xs text-slate-500">Ketuk peta atau geser pin 📍 tepat di bangunan kosmu. Titik ini diperiksa admin; memindahkannya jauh nanti memerlukan verifikasi ulang.</p>
        {willReverify && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Pin bergeser sekitar {Math.round(moved)} m. Kalau disimpan, kos ini hilang dari pencarian sampai admin memverifikasi ulang.
          </div>
        )}
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Deskripsi</span>
        <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} className={input} placeholder="Suasana, sekitar kos, hal penting lain." />
      </label>

      <button disabled={busy} className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60">{busy ? busyLabel : submitLabel}</button>
    </form>
  );
}
