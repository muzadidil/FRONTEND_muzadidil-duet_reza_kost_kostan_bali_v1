// Klien tipis untuk API Laravel. Token Sanctum disimpan di localStorage (aplikasi ini situs statis tanpa server,
// jadi tidak ada cookie sesi). Alamat API ditentukan saat build lewat NEXT_PUBLIC_API_URL.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://kost.rezasku.com/api").replace(/\/$/, "");

const TOKEN_KEY = "kos_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* penyimpanan diblokir: pengguna harus masuk lagi tiap muat ulang */
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(status: number, message: string, code?: string, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
};

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { method: options.method ?? "GET", headers, body });
  } catch {
    throw new ApiError(0, "Tidak bisa menghubungi server. Periksa koneksi internet.");
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const firstError = data?.errors ? Object.values<string[]>(data.errors)[0]?.[0] : undefined;
    throw new ApiError(response.status, firstError ?? data?.message ?? `Terjadi kesalahan (${response.status}).`, data?.code, data?.errors);
  }

  return data as T;
}

// ---------- Tipe data (hanya yang dipakai layar) ----------

export type Photo = { id: number; url: string; thumbnail_url: string };

export type Room = {
  id: number;
  name: string;
  price: number;
  price_daily: number | null;
  price_yearly: number | null;
  length_m: number | null;
  width_m: number | null;
  area_m2: number | null;
  bathroom: string | null;
  bathroom_label: string | null;
  electricity: string | null;
  electricity_label: string | null;
  has_tv: boolean;
  has_wardrobe: boolean;
  wardrobe_size: string | null;
  wardrobe_has_hanger: boolean;
  status: string;
  is_available: boolean;
  photos?: Photo[];
};

export type KosSummary = {
  id: number;
  name: string;
  public_area: string | null;
  property_type: string;
  resident_type: string | null;
  is_sharia: boolean;
  latitude: number;
  longitude: number;
  location_is_approximate: boolean;
  starting_price: number | null;
  rating_avg: number | null;
  rating_count: number;
  thumbnail_url: string | null;
  distance_m: number;
};

export type KosDetail = {
  id: number;
  name: string;
  address: string | null;
  public_area: string | null;
  location_is_approximate: boolean;
  listed_by: string | null;
  listed_by_label: string | null;
  property_type: string;
  property_type_label: string;
  resident_type: string | null;
  resident_type_label: string | null;
  is_sharia: boolean;
  curfew_time: string | null;
  is_open_24h: boolean;
  parking_motorcycle: boolean;
  parking_car: boolean;
  bicycle_inside: boolean;
  has_laundry_area: boolean;
  latitude: number;
  longitude: number;
  description: string | null;
  starting_price: number | null;
  rating_avg: number | null;
  rating_count: number;
  rooms_total: number;
  rooms_available: number;
  photos: Photo[];
  rooms: Room[];
  is_verified?: boolean;
};

/** Pengaturan publik dari server (GET /app-config): nominal PO dan fitur yang sudah diaktifkan admin. */
export type AppConfig = {
  demo: boolean;
  po: { fee: number; answer_hours: number; payment_hours: number; valid_days: number };
  google: { client_id: string } | null;
  pusher: { key: string; cluster: string } | null;
  maps: { browser_key: string | null; places: boolean; routing: boolean };
  fcm: { project_id: string } | null;
};

export const DEFAULT_PO_FEE = 50000;

let appConfigPromise: Promise<AppConfig | null> | null = null;

/** Diambil sekali per muat halaman. Gagal (server mati, versi lama) dijawab null; layar memakai nilai bawaan. */
export function getAppConfig(): Promise<AppConfig | null> {
  appConfigPromise ??= api<AppConfig>("/app-config").catch(() => null);
  return appConfigPromise;
}

export type RouteInfo = { distance_m: number; duration_s: number; polyline: string };

export type BookingActions = {
  can_answer: boolean;
  can_cancel: boolean;
  can_pay: boolean;
  can_confirm_deal: boolean;
  can_request_refund: boolean;
  can_chat: boolean;
  can_review: boolean;
};

export type Booking = {
  id: number;
  number: string;
  status: string;
  status_label: string;
  role: "customer" | "manager";
  kos: KosDetail | null;
  room: { id: number; name: string; price: number } | null;
  fee_amount: number;
  requested_at: string;
  answer_deadline_at: string;
  payment_deadline_at: string | null;
  paid_at: string | null;
  valid_until: string | null;
  completed_at: string | null;
  customer_confirmed_at: string | null;
  manager_confirmed_at: string | null;
  counterpart: { name: string; phone: string | null } | null;
  receipt: { number: string; title: string; note: string; amount: number; paid_at: string; valid_until: string; reference: string | null } | null;
  refund: { status: string; status_label: string; reason_label: string | null; note: string | null; decision_note: string | null } | null;
  actions: BookingActions;
};

export type Message = { id: number; sender_id: number; is_mine: boolean | null; body: string; created_at: string };

export type User = { id: number; name: string; email: string; phone: string | null; needs_phone: boolean; role: string; is_manager: boolean };
