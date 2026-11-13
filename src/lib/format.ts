export function rupiah(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return "Rp" + new Intl.NumberFormat("id-ID").format(value);
}

/** Harga ringkas untuk penanda di peta: 1.600.000 -> "1,6jt". */
export function rupiahShort(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1).replace(".", ",")}jt`;
  return `${Math.round(value / 1000)}rb`;
}

export function distance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function date(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Sisa waktu menuju iso, mis. "5 jam 20 menit" (atau "habis"). */
export function remaining(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "habis";
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} hari ${hours} jam`;
  if (hours > 0) return `${hours} jam ${minutes % 60} menit`;
  return `${minutes} menit`;
}
