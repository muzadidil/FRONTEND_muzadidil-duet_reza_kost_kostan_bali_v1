"use client";

import Link from "@/components/Link";
import { useCallback, useEffect, useMemo, useState } from "react";
import KosMap, { type MapMarker } from "@/components/KosMap";
import { KosCard } from "@/components/KosCard";
import { LocationIcon } from "@/components/icons";
import { api, type KosSummary } from "@/lib/api";
import { distance, rupiah, rupiahShort } from "@/lib/format";
import { btnOutlineSm, btnPrimary, input, selectSm } from "@/lib/ui";

const CANGGU: [number, number] = [-8.6478, 115.1385];
const RADII = [1, 3, 5, 10, 20];

type NearbyResponse = { data: KosSummary[]; meta: { total: number } };
type Place = { display_name: string; lat: string; lon: string };

export default function SearchPage() {
  const [pin, setPin] = useState<[number, number]>(CANGGU);
  const [center, setCenter] = useState<[number, number]>(CANGGU);
  const [radiusKm, setRadiusKm] = useState(5);
  const [results, setResults] = useState<KosSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  // Memuat kos terdekat tiap pin atau radius berubah (ditunda sebentar supaya menggeser pin tidak membanjiri server).
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api<NearbyResponse>(`/kos/nearby?lat=${pin[0]}&lng=${pin[1]}&radius=${radiusKm * 1000}&per_page=50`);
        if (cancelled) return;
        setResults(res.data);
        setTotal(res.meta.total);
        setSelectedId((current) => (res.data.some((k) => k.id === current) ? current : null));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat kos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pin, radiusKm]);

  const movePin = useCallback((lat: number, lng: number) => setPin([lat, lng]), []);

  const markers: MapMarker[] = useMemo(
    () => results.map((k) => ({ id: k.id, lat: k.latitude, lng: k.longitude, label: rupiahShort(k.starting_price), selected: k.id === selectedId })),
    [results, selectedId],
  );

  const selected = results.find((k) => k.id === selectedId) ?? null;

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Peramban ini tidak mendukung lokasi. Geser pin secara manual.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPin(next);
        setCenter(next);
      },
      () => setError("Lokasi tidak diizinkan. Geser pin atau cari nama daerah."),
      { timeout: 8000 },
    );
  }

  async function searchPlace(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setPlaces([]);
    try {
      // Pencarian nama tempat memakai layanan Nominatim milik OpenStreetMap (gratis, dibatasi ke Indonesia).
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=id&limit=5&q=${encodeURIComponent(query)}`);
      const data: Place[] = await res.json();
      setPlaces(data);
      if (data.length === 0) setError("Tempat tidak ditemukan. Coba nama lain atau geser pin.");
    } catch {
      setError("Pencarian tempat gagal. Geser pin secara manual.");
    } finally {
      setSearching(false);
    }
  }

  function pickPlace(p: Place) {
    const next: [number, number] = [parseFloat(p.lat), parseFloat(p.lon)];
    setPin(next);
    setCenter(next);
    setPlaces([]);
    setQuery(p.display_name.split(",")[0]);
  }

  return (
    <div className="flex flex-1 flex-col md:h-[calc(100dvh-var(--header-h))] md:flex-row">
      <section className="order-2 flex min-h-0 flex-1 flex-col border-t bg-slate-50 md:order-1 md:w-[26rem] md:flex-none md:border-r md:border-t-0">
        <div className="space-y-3 border-b bg-white p-4">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-brand">Cari kos terdekat</h1>
            <p className="text-xs text-slate-500">Geser pin di peta ke tempat kerja atau tujuanmu. Kos terdekat muncul di bawah.</p>
          </div>

          <form onSubmit={searchPlace} className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari tempat kerja atau daerah..." className={`${input} min-w-0 flex-1`} />
            <button className={btnPrimary} disabled={searching}>
              {searching ? "..." : "Cari"}
            </button>
          </form>

          {places.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded-xl border bg-white text-sm shadow-sm">
              {places.map((p) => (
                <li key={`${p.lat},${p.lon}`}>
                  <button onClick={() => pickPlace(p)} className="w-full truncate px-3 py-2 text-left hover:bg-brand-wash">{p.display_name}</button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2">
            <button onClick={useMyLocation} className={btnOutlineSm}>
              <LocationIcon /> Lokasi saya
            </button>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Radius
              <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className={selectSm}>
                {RADII.map((r) => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {selected && (
          <div className="space-y-2 border-b border-l-4 border-l-gold bg-gold-soft/60 p-4 text-sm">
            <div className="font-bold text-brand-dark">{selected.name}</div>
            <div className="text-slate-600">
              Jarak perkiraan ±{distance(selected.distance_m)} dari pin. Titik tepat kos dan rute terbuka setelah PO dibayar.
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-brand">{rupiah(selected.starting_price)}<span className="text-xs font-normal text-slate-500">/bln</span></span>
              <Link href={`/kos/?id=${selected.id}`} className={btnPrimary}>
                Cek lebih detail
              </Link>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-2.5 overflow-auto p-3">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {loading && results.length === 0 && <div className="py-6 text-center text-sm text-slate-500">Memuat kos...</div>}
          {!loading && !error && results.length === 0 && (
            <div className="rounded-xl border border-dashed bg-white p-4 text-center text-sm text-slate-600">
              Belum ada kos dalam radius {radiusKm} km dari pin ini. Perbesar radius atau geser pin ke daerah lain (mis. Canggu, Seminyak, Denpasar).
            </div>
          )}
          {results.length > 0 && <div className="px-1 text-xs font-medium text-slate-500">{total} kos dalam {radiusKm} km, dari yang terdekat</div>}
          {results.map((k) => (
            <KosCard key={k.id} kos={k} selected={k.id === selectedId} onSelect={() => setSelectedId(k.id)} />
          ))}
        </div>
      </section>

      <section className="order-1 h-[46dvh] md:order-2 md:h-auto md:flex-1">
        <KosMap
          center={center}
          zoom={13}
          pin={pin}
          onPinChange={movePin}
          clickToPlacePin={false}
          markers={markers}
          onMarkerClick={setSelectedId}
          lineTo={selected ? [selected.latitude, selected.longitude] : null}
        />
      </section>
    </div>
  );
}
