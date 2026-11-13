"use client";

import { useEffect, useState } from "react";
import { getAppConfig } from "@/lib/api";
import { googleMapsFailed, onGoogleMapsFailure } from "@/lib/googleMaps";
import GoogleKosMap from "./map/GoogleMap";
import LeafletKosMap from "./map/LeafletMap";
import type { KosMapProps } from "./map/types";

export type { MapMarker } from "./map/types";

type Engine = { kind: "loading" } | { kind: "leaflet" } | { kind: "google"; key: string };

/**
 * Peta situs. Memakai Google Maps kalau admin sudah mengisi "Kunci browser" di Pengaturan (dibaca dari /api/app-config).
 * Kalau kunci belum diisi, ditolak Google, atau Google tidak bisa dimuat, memakai OpenStreetMap (Leaflet) sebagai
 * cadangan, jadi peta tidak pernah kosong.
 */
export default function KosMap(props: KosMapProps) {
  const [engine, setEngine] = useState<Engine>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getAppConfig().then((config) => {
      if (cancelled) return;
      const key = config?.maps?.browser_key?.trim();
      setEngine(key && !googleMapsFailed() ? { kind: "google", key } : { kind: "leaflet" });
    });
    const stop = onGoogleMapsFailure(() => setEngine({ kind: "leaflet" }));
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  if (engine.kind === "loading") return <div aria-hidden className={`${props.className ?? "h-full w-full"} animate-pulse bg-slate-100`} />;
  if (engine.kind === "google") return <GoogleKosMap {...props} apiKey={engine.key} onFail={() => setEngine({ kind: "leaflet" })} />;
  return <LeafletKosMap {...props} />;
}
