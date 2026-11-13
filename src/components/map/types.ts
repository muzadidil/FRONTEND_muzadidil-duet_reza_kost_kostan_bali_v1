export type MapMarker = { id: number; lat: number; lng: number; label: string; selected?: boolean };

export type KosMapProps = {
  center: [number, number];
  zoom?: number;
  /** Pin orang (titik pencarian). Bisa digeser kalau onPinChange diberikan. */
  pin?: [number, number] | null;
  onPinChange?: (lat: number, lng: number) => void;
  /** Klik pada peta memindahkan pin (untuk memilih lokasi). */
  clickToPlacePin?: boolean;
  markers?: MapMarker[];
  onMarkerClick?: (id: number) => void;
  /** Lingkaran perkiraan lokasi (meter). */
  area?: { lat: number; lng: number; radius: number } | null;
  /** Garis dari pin ke titik ini. */
  lineTo?: [number, number] | null;
  /** Rute jalan (daftar titik) yang digambar sebagai garis biru, lalu peta menyesuaikan tampilan. */
  route?: [number, number][] | null;
  className?: string;
};
