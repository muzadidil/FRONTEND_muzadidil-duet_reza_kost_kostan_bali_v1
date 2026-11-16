"use client";

import Link from "@/components/Link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import KosMap from "@/components/KosMap";
import { Badges, Stars } from "@/components/KosCard";
import { api, ApiError, DEFAULT_PO_FEE, getAppConfig, type KosDetail, type Room } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupiah } from "@/lib/format";

type Review = { id: number; author: string; rating: number; comment: string | null; created_at: string };
type ReviewsResponse = { summary: { rating_avg: number | null; rating_count: number }; data: Review[] };


function Fact({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-slate-800" : "text-slate-500 line-through"}`}>
      <span>{ok ? "✓" : "✗"}</span>
      {children}
    </li>
  );
}

function RoomCard({ room, canOrder, busy, fee, onOrder }: { room: Room; canOrder: boolean; busy: boolean; fee: number; onOrder: () => void }) {
  const photo = room.photos?.[0];
  return (
    <div className="flex gap-3 rounded-xl border bg-white p-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.thumbnail_url} alt="" className="h-24 w-28 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl">🛏️</div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-semibold">{room.name}</h3>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${room.is_available ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
            {room.is_available ? "Kosong" : "Terisi"}
          </span>
        </div>
        <div className="text-sm">
          <span className="font-bold text-brand">{rupiah(room.price)}</span>
          <span className="text-xs text-slate-500">/bulan</span>
          {room.price_daily && <span className="ml-2 text-xs text-slate-500">{rupiah(room.price_daily)}/hari</span>}
          {room.price_yearly && <span className="ml-2 text-xs text-slate-500">{rupiah(room.price_yearly)}/tahun</span>}
        </div>
        <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
          {room.area_m2 && <span className="rounded bg-slate-100 px-1.5 py-0.5">{room.length_m}×{room.width_m} m ({room.area_m2} m²)</span>}
          {room.bathroom_label && <span className="rounded bg-slate-100 px-1.5 py-0.5">{room.bathroom_label}</span>}
          {room.electricity_label && <span className="rounded bg-slate-100 px-1.5 py-0.5">{room.electricity_label}</span>}
          {room.has_tv && <span className="rounded bg-slate-100 px-1.5 py-0.5">TV</span>}
          {room.has_wardrobe && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5">Lemari{room.wardrobe_size ? ` (${room.wardrobe_size})` : ""}{room.wardrobe_has_hanger ? ", ada gantungan" : ""}</span>
          )}
        </div>
        {room.is_available && canOrder && (
          <button onClick={onOrder} disabled={busy} className="mt-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
            {busy ? "Mengajukan..." : `Ajukan PO ${rupiah(fee)}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Detail() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, ready } = useAuth();
  const id = params.get("id");

  const [kos, setKos] = useState<KosDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [busyRoom, setBusyRoom] = useState<number | null>(null);
  // Nominal PO ditetapkan server (bisa berubah lewat konfigurasi); angka bawaan dipakai kalau server belum menjawab.
  const [PO_FEE, setPoFee] = useState(DEFAULT_PO_FEE);
  useEffect(() => {
    getAppConfig().then((config) => config && setPoFee(config.po.fee));
  }, []);

  useEffect(() => {
    if (!id) return;
    api<{ data: KosDetail }>(`/kos/${id}`)
      .then((r) => setKos(r.data))
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "Kos tidak ditemukan." : (e as Error).message));
    api<ReviewsResponse>(`/kos/${id}/reviews`).then(setReviews).catch(() => setReviews(null));
  }, [id]);

  async function order(room: Room) {
    setOrderError(null);
    setBusyRoom(room.id);
    try {
      const res = await api<{ data: { id: number } }>(`/kos/${id}/bookings`, { method: "POST", body: { room_id: room.id } });
      router.push(`/pesanan/detail/?id=${res.data.id}`);
    } catch (e) {
      setBusyRoom(null);
      if (e instanceof ApiError && e.code === "phone_required") {
        setOrderError("Isi nomor HP dulu di halaman Masuk sebelum memesan.");
      } else {
        setOrderError(e instanceof Error ? e.message : "Gagal mengajukan PO.");
      }
    }
  }

  if (!id) return <div className="p-6 text-sm text-slate-600">Kos tidak dipilih. <Link href="/cari/" className="text-brand underline">Kembali ke pencarian</Link></div>;
  if (error) return <div className="p-6 text-sm text-red-700">{error} <Link href="/cari/" className="text-brand underline">Kembali</Link></div>;
  if (!kos) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;

  const extras: string[] = [];
  if (kos.property_type_label !== "Kos") extras.push(kos.property_type_label);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <div className="flex gap-2 overflow-x-auto px-4 pt-4">
        {kos.photos.length === 0 && <div className="flex h-48 w-full items-center justify-center rounded-xl bg-slate-100 text-4xl">🏠</div>}
        {kos.photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt="" className="h-52 w-80 shrink-0 rounded-xl object-cover" />
        ))}
      </div>

      <div className="space-y-2 px-4">
        <Link href="/cari/" className="text-sm text-brand">← Kembali ke peta</Link>
        <h1 className="text-xl font-bold">{kos.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Stars avg={kos.rating_avg} count={kos.rating_count} />
          <Badges resident={kos.resident_type} sharia={kos.is_sharia} extra={[...extras, ...(kos.listed_by_label ? [kos.listed_by_label] : [])]} />
        </div>
        <div className="text-sm text-slate-600">
          {kos.rooms_available} dari {kos.rooms_total} kamar kosong · mulai <span className="font-semibold text-brand">{rupiah(kos.starting_price)}</span>/bulan
        </div>
      </div>

      <section className="space-y-2 px-4">
        <h2 className="font-semibold">Lokasi perkiraan</h2>
        <div className="h-56 overflow-hidden rounded-xl border">
          <KosMap center={[kos.latitude, kos.longitude]} zoom={15} area={{ lat: kos.latitude, lng: kos.longitude, radius: 450 }} />
        </div>
        <p className="text-xs text-slate-500">
          Kos ada di sekitar lingkaran ini ({kos.public_area ?? "area ini"}). Titik tepat, nama kos, alamat, dan rute terbuka setelah PO dibayar.
        </p>
      </section>

      {kos.description && <p className="px-4 text-sm leading-relaxed text-slate-700">{kos.description}</p>}

      <section className="space-y-2 px-4">
        <h2 className="font-semibold">Aturan dan fasilitas</h2>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          <Fact ok={true}>{kos.resident_type_label ? `Khusus ${kos.resident_type_label.toLowerCase()}` : "Penghuni belum ditentukan"}</Fact>
          <Fact ok={kos.is_sharia}>Syariah{kos.is_sharia ? " (satu kamar sesama jenis; pasangan wajib bukti nikah)" : ""}</Fact>
          <Fact ok={true}>{kos.is_open_24h ? "Bebas 24 jam" : `Jam malam ${kos.curfew_time}`}</Fact>
          <Fact ok={kos.parking_motorcycle}>Parkir motor</Fact>
          <Fact ok={kos.parking_car}>Parkir mobil</Fact>
          <Fact ok={kos.bicycle_inside}>Sepeda boleh dibawa masuk</Fact>
          <Fact ok={kos.has_laundry_area}>Tempat cuci baju</Fact>
        </ul>
      </section>

      <section className="space-y-3 px-4">
        <h2 className="font-semibold">Kamar</h2>
        {orderError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {orderError} {orderError.includes("nomor HP") && <Link href="/masuk/" className="underline">Buka halaman Masuk</Link>}
          </div>
        )}
        {ready && !user && (
          <div className="rounded-lg bg-brand-wash p-3 text-sm text-brand-dark">
            <Link href={`/masuk/?next=${encodeURIComponent(`/kos/?id=${kos.id}`)}`} className="font-semibold underline">Masuk</Link> dulu untuk mengajukan PO.
          </div>
        )}
        {kos.rooms.map((r) => (
          <RoomCard key={r.id} room={r} canOrder={!!user} busy={busyRoom === r.id} fee={PO_FEE} onOrder={() => order(r)} />
        ))}
        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <strong>Cara kerja PO.</strong> Ajukan PO, pengelola menjawab apakah kamar masih kosong, lalu kamu membayar biaya jasa {rupiah(PO_FEE)}.
          Setelah itu titik tepat, rute, dan chat dengan pengelola terbuka. Biaya ini di luar harga sewa; sewa dibayar langsung di kos.
          Kalau tidak jadi menempati, PO hangus. Uang kembali hanya jika kamar ternyata terisi, data kos tidak sesuai, atau pengelola tidak muncul.
        </div>
      </section>

      <section className="space-y-2 px-4">
        <h2 className="font-semibold">Ulasan penghuni</h2>
        {!reviews || reviews.data.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada ulasan. Bintang hanya bisa diberikan oleh penghuni yang sudah deal.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.data.map((r) => (
              <li key={r.id} className="rounded-xl border bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.author}</span>
                  <span className="text-star">{"★".repeat(r.rating)}<span className="text-slate-400">{"★".repeat(5 - r.rating)}</span></span>
                </div>
                {r.comment && <p className="mt-1 text-slate-700">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function KosPage() {
  // useSearchParams memerlukan Suspense pada ekspor statis.
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat...</div>}>
      <Detail />
    </Suspense>
  );
}
