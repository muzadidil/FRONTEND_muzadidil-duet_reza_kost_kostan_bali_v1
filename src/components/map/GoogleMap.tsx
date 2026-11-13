"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { personElement, pillElement, placeElement } from "@/lib/mapIcons";
import { BRAND, GOLD_DARK, ROUTE } from "@/lib/mapTheme";
import type { KosMapProps } from "./types";

// Peta Google. Dipakai hanya kalau admin mengisi "Kunci browser" di Pengaturan (dan mengaktifkan Maps JavaScript API).
// Peta disembunyikan sampai gambar petanya benar-benar termuat, jadi kalau kuncinya ditolak pengunjung tidak melihat
// kotak galat Google: KosMap langsung memakai peta cadangan (onFail).

// Penanda canggih Google butuh ID peta. DEMO_MAP_ID adalah ID uji milik Google yang berlaku untuk kunci apa pun;
// ganti dengan ID peta sendiri (Google Cloud Console, Map Management) kalau ingin warna peta disesuaikan dengan merek.
const MAP_ID = "DEMO_MAP_ID";
const VISIBLE_TIMEOUT_MS = 10000;

type Props = KosMapProps & { apiKey: string; onFail: () => void };

type Libs = {
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
  Circle: typeof google.maps.Circle;
  Polyline: typeof google.maps.Polyline;
  LatLngBounds: typeof google.maps.LatLngBounds;
};

type Position = google.maps.LatLng | google.maps.LatLngLiteral | google.maps.LatLngAltitude | google.maps.LatLngAltitudeLiteral | null | undefined;

/** Posisi penanda bisa berbentuk objek LatLng (metode) atau literal (angka), tergantung versi Google. */
function literal(p: Position): google.maps.LatLngLiteral | null {
  if (!p) return null;
  return { lat: typeof p.lat === "function" ? p.lat() : p.lat, lng: typeof p.lng === "function" ? p.lng() : p.lng };
}

export default function GoogleKosMap({ apiKey, onFail, center, zoom = 14, pin, onPinChange, clickToPlacePin, markers = [], onMarkerClick, area, lineTo, route, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const libsRef = useRef<Libs | null>(null);
  const pinRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const markerLayer = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const areaRef = useRef<google.maps.Circle | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const routeRef = useRef<google.maps.Polyline | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  // Pusat dan zoom awal hanya dipakai saat peta dibuat; perubahan pusat sesudahnya ditangani efek terpisah.
  const initial = useRef({ center, zoom });

  // Callback terbaru disimpan di ref supaya peta tidak dibuat ulang tiap render.
  const onPinChangeRef = useRef(onPinChange);
  const onMarkerClickRef = useRef(onMarkerClick);
  const clickRef = useRef(clickToPlacePin);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onPinChangeRef.current = onPinChange;
    onMarkerClickRef.current = onMarkerClick;
    clickRef.current = clickToPlacePin;
    onFailRef.current = onFail;
  });

  // Membuat peta sekali.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        await loadGoogleMaps(apiKey);
        const { Map: GMap, Circle, Polyline } = await google.maps.importLibrary("maps");
        const { LatLngBounds } = await google.maps.importLibrary("core");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        if (cancelled || !host.current) return;

        const map = new GMap(host.current, {
          center: { lat: initial.current.center[0], lng: initial.current.center[1] },
          zoom: initial.current.zoom,
          mapId: MAP_ID,
          gestureHandling: "greedy",
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          keyboardShortcuts: false,
        });

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (clickRef.current && e.latLng) onPinChangeRef.current?.(e.latLng.lat(), e.latLng.lng());
        });
        map.addListener("tilesloaded", () => {
          if (timer) clearTimeout(timer);
          setVisible(true);
        });

        mapRef.current = map;
        libsRef.current = { AdvancedMarkerElement, Circle, Polyline, LatLngBounds };
        setReady(true);
        // Kalau gambar peta tidak kunjung termuat (kunci ditolak, jaringan menahan Google), pakai peta cadangan.
        timer = setTimeout(() => onFailRef.current(), VISIBLE_TIMEOUT_MS);
      } catch {
        if (!cancelled) onFailRef.current();
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      markerLayer.current.forEach((m) => {
        m.map = null;
      });
      markerLayer.current = [];
      if (pinRef.current) pinRef.current.map = null;
      pinRef.current = null;
      areaRef.current?.setMap(null);
      areaRef.current = null;
      lineRef.current?.setMap(null);
      lineRef.current = null;
      routeRef.current?.setMap(null);
      routeRef.current = null;
      if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current);
      mapRef.current = null;
      libsRef.current = null;
    };
  }, [apiKey]);

  // Menyinkronkan pin, penanda, lingkaran, dan garis dengan props.
  useEffect(() => {
    const map = mapRef.current;
    const libs = libsRef.current;
    if (!ready || !map || !libs) return;
    const { AdvancedMarkerElement, Circle, Polyline, LatLngBounds } = libs;

    // Pin
    if (pin) {
      const position = { lat: pin[0], lng: pin[1] };
      if (!pinRef.current) {
        const m = new AdvancedMarkerElement({
          map,
          position,
          content: clickToPlacePin ? placeElement("google") : personElement("google"),
          gmpDraggable: !!onPinChange,
          zIndex: 1000,
          title: clickToPlacePin ? "Lokasi kos" : "Titik pencarian",
        });
        m.addListener("dragend", () => {
          const p = literal(m.position);
          if (p) onPinChangeRef.current?.(p.lat, p.lng);
        });
        pinRef.current = m;
      } else {
        pinRef.current.position = position;
      }
    } else if (pinRef.current) {
      pinRef.current.map = null;
      pinRef.current = null;
    }

    // Penanda kos
    markerLayer.current.forEach((m) => {
      m.map = null;
    });
    markerLayer.current = markers.map((mk) => {
      const m = new AdvancedMarkerElement({
        map,
        position: { lat: mk.lat, lng: mk.lng },
        content: pillElement("google", mk.label, !!mk.selected),
        zIndex: mk.selected ? 900 : 0,
        gmpClickable: true,
        title: mk.label,
      });
      m.addListener("click", () => onMarkerClickRef.current?.(mk.id));
      return m;
    });

    // Lingkaran perkiraan
    areaRef.current?.setMap(null);
    areaRef.current = area
      ? new Circle({
          map,
          center: { lat: area.lat, lng: area.lng },
          radius: area.radius,
          strokeColor: BRAND,
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: BRAND,
          fillOpacity: 0.12,
          clickable: false,
        })
      : null;

    // Garis pin -> kos (putus-putus)
    lineRef.current?.setMap(null);
    lineRef.current =
      pin && lineTo
        ? new Polyline({
            map,
            path: [
              { lat: pin[0], lng: pin[1] },
              { lat: lineTo[0], lng: lineTo[1] },
            ],
            strokeOpacity: 0,
            clickable: false,
            icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: GOLD_DARK, strokeWeight: 3, scale: 3 }, offset: "0", repeat: "14px" }],
          })
        : null;

    // Rute jalan
    routeRef.current?.setMap(null);
    routeRef.current = null;
    if (route && route.length > 1) {
      const path = route.map(([lat, lng]) => ({ lat, lng }));
      routeRef.current = new Polyline({ map, path, strokeColor: ROUTE, strokeOpacity: 0.9, strokeWeight: 5, clickable: false });
      const bounds = new LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 30);
    }
  }, [ready, pin, markers, area, lineTo, route, onPinChange, clickToPlacePin]);

  // Memindahkan tampilan kalau pusat berubah dari luar (mis. hasil cari daerah).
  const [lat, lng] = center;
  useEffect(() => {
    if (ready) mapRef.current?.setCenter({ lat, lng });
  }, [ready, lat, lng]);

  return (
    <div className={`relative ${className ?? "h-full w-full"}`}>
      <div ref={host} className="absolute inset-0" style={{ visibility: visible ? "visible" : "hidden" }} />
      {!visible && <div aria-hidden className="absolute inset-0 animate-pulse bg-slate-100" />}
    </div>
  );
}
