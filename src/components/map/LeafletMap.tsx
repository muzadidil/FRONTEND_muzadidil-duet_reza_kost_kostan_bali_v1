"use client";

import { useEffect, useRef } from "react";
import type { Circle, DivIcon, LatLngExpression, Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { personElement, pillElement, placeElement } from "@/lib/mapIcons";
import { BRAND, GOLD_DARK, ROUTE } from "@/lib/mapTheme";
import type { KosMapProps } from "./types";

// Peta cadangan (OpenStreetMap lewat Leaflet): dipakai kalau admin belum mengisi kunci browser Google, atau kalau
// Google menolak kuncinya. Tidak butuh kunci apa pun.

function icon(L: typeof import("leaflet"), html: HTMLElement): DivIcon {
  return L.divIcon({ className: "", html, iconSize: [0, 0] });
}

export default function LeafletKosMap({ center, zoom = 14, pin, onPinChange, clickToPlacePin, markers = [], onMarkerClick, area, lineTo, route, className }: KosMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const markerLayer = useRef<Marker[]>([]);
  const areaRef = useRef<Circle | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const routeRef = useRef<Polyline | null>(null);

  // Callback terbaru disimpan di ref supaya peta tidak dibuat ulang tiap render.
  const onPinChangeRef = useRef(onPinChange);
  const onMarkerClickRef = useRef(onMarkerClick);
  const clickRef = useRef(clickToPlacePin);
  useEffect(() => {
    onPinChangeRef.current = onPinChange;
    onMarkerClickRef.current = onMarkerClick;
    clickRef.current = clickToPlacePin;
  });

  // Membuat peta sekali.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !host.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(host.current, { zoomControl: true }).setView(center as LatLngExpression, zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      map.on("click", (e) => {
        if (clickRef.current) onPinChangeRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      // Memicu efek di bawah setelah peta siap.
      map.fire("kos:ready");
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menyinkronkan pin, penanda, lingkaran, dan garis dengan props.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const sync = () => {
      const map = mapRef.current;
      const L = leafletRef.current;
      if (!map || !L) {
        timer = setTimeout(sync, 50);
        return;
      }

      // Pin
      if (pin) {
        if (!pinRef.current) {
          const m = L.marker(pin, {
            icon: icon(L, clickToPlacePin ? placeElement("leaflet") : personElement("leaflet")),
            draggable: !!onPinChange,
            zIndexOffset: 1000,
          }).addTo(map);
          m.on("dragend", () => {
            const p = m.getLatLng();
            onPinChangeRef.current?.(p.lat, p.lng);
          });
          pinRef.current = m;
        } else {
          pinRef.current.setLatLng(pin);
        }
      } else if (pinRef.current) {
        pinRef.current.remove();
        pinRef.current = null;
      }

      // Penanda kos
      markerLayer.current.forEach((m) => m.remove());
      markerLayer.current = markers.map((mk) => {
        const m = L.marker([mk.lat, mk.lng], { icon: icon(L, pillElement("leaflet", mk.label, !!mk.selected)), zIndexOffset: mk.selected ? 900 : 0 }).addTo(map);
        m.on("click", () => onMarkerClickRef.current?.(mk.id));
        return m;
      });

      // Lingkaran perkiraan
      areaRef.current?.remove();
      areaRef.current = area ? L.circle([area.lat, area.lng], { radius: area.radius, color: BRAND, weight: 2, fillColor: BRAND, fillOpacity: 0.12 }).addTo(map) : null;

      // Garis pin -> kos
      lineRef.current?.remove();
      lineRef.current = pin && lineTo ? L.polyline([pin, lineTo], { color: GOLD_DARK, weight: 4, dashArray: "8 8" }).addTo(map) : null;

      // Rute jalan
      routeRef.current?.remove();
      routeRef.current = null;
      if (route && route.length > 1) {
        routeRef.current = L.polyline(route, { color: ROUTE, weight: 5, opacity: 0.85 }).addTo(map);
        map.fitBounds(routeRef.current.getBounds(), { padding: [30, 30] });
      }
    };

    sync();
    return () => clearTimeout(timer);
  }, [pin, markers, area, lineTo, route, onPinChange, clickToPlacePin]);

  // Memindahkan tampilan kalau pusat berubah dari luar (mis. hasil cari daerah).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const move = () => {
      if (!mapRef.current) {
        timer = setTimeout(move, 50);
        return;
      }
      mapRef.current.setView(center as LatLngExpression, mapRef.current.getZoom());
    };
    move();
    return () => clearTimeout(timer);
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} className={className ?? "h-full w-full"} />;
}
