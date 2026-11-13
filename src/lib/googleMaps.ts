// Pemuat Google Maps JavaScript API. Skripnya dimuat hanya kalau admin mengisi "Kunci browser" di Pengaturan,
// dan hanya sekali per halaman. Kalau Google menolak (kunci salah, API belum diaktifkan, penagihan mati) atau skripnya
// tidak bisa dimuat, situs memakai peta cadangan (OpenStreetMap) untuk sisa halaman itu.

const CALLBACK = "__kosGoogleMapsSiap";

let promise: Promise<void> | null = null;
let failed = false;
const listeners = new Set<() => void>();

export function googleMapsFailed(): boolean {
  return failed;
}

/** Dipanggil saat Google menolak atau gagal dimuat. Mengembalikan fungsi untuk berhenti mendengarkan. */
export function onGoogleMapsFailure(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function fail(): void {
  if (failed) return;
  failed = true;
  listeners.forEach((listener) => listener());
}

export function loadGoogleMaps(key: string): Promise<void> {
  if (failed) return Promise.reject(new Error("Google Maps menolak kunci ini."));
  if (promise) return promise;

  const w = window as unknown as Record<string, unknown>;
  // Google memanggil fungsi ini kalau kunci tidak sah untuk alamat situs ini, API belum diaktifkan, atau penagihan mati.
  w.gm_authFailure = fail;

  promise = new Promise<void>((resolve, reject) => {
    w[CALLBACK] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=id&region=ID&callback=${CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      fail();
      reject(new Error("Tidak bisa memuat Google Maps."));
    };
    document.head.appendChild(script);
  });

  return promise;
}
