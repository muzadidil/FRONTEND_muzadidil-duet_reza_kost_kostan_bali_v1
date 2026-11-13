"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/components/Shell";
import { api, getAppConfig, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadGoogleIdentity } from "@/lib/google";
import { btnBrandOutline, btnPrimary, card, input } from "@/lib/ui";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Hanya jalur di situs ini yang boleh dituju setelah masuk, supaya tautan buatan orang lain tidak bisa
// mengirim pengguna ke situs luar.
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, demo, ready, signIn, refresh } = useAuth();
  const next = safeNext(params.get("next"));

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [googleId, setGoogleId] = useState<string | null>(null);
  const googleBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAppConfig().then((config) => setGoogleId(config?.google?.client_id ?? null));
  }, []);

  // Hasil masuk dari Google diproses oleh versi terbaru fungsi ini (disimpan di ref supaya tombol tidak dibuat ulang).
  const onCredential = useRef<(credential: string) => Promise<void>>(async () => undefined);
  useEffect(() => {
    onCredential.current = async (credential: string) => {
      setError(null);
      setBusy("google");
      try {
        const res = await api<{ token: string; user: User; needs_phone: boolean }>("/auth/google", { method: "POST", body: { id_token: credential, device_name: "web" } });
        signIn(res.token, { ...res.user, needs_phone: res.needs_phone });
        if (!res.needs_phone) router.push(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal masuk dengan Google.");
      } finally {
        setBusy(null);
      }
    };
  });

  useEffect(() => {
    if (!googleId || user || !ready) return;
    let cancelled = false;

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !googleBox.current) return;
        google.initialize({ client_id: googleId, callback: (response) => response.credential && void onCredential.current(response.credential), ux_mode: "popup" });
        google.renderButton(googleBox.current, { theme: "outline", size: "large", width: 320, text: "continue_with", shape: "pill", locale: "id" });
      })
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
    };
  }, [googleId, user, ready]);

  async function demoLogin(role: "customer" | "manager") {
    setBusy(role);
    setError(null);
    try {
      const res = await api<{ token: string; user: User }>("/auth/demo", { method: "POST", body: { role } });
      signIn(res.token, res.user);
      router.push(role === "manager" ? "/pengelola/" : next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal masuk.");
      setBusy(null);
    }
  }

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("phone");
    try {
      await api("/me/phone", { method: "PUT", body: { phone } });
      await refresh();
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan nomor.");
      setBusy(null);
    }
  }

  if (!ready) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="mx-auto w-full max-w-md space-y-5 p-5 pt-8">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE}/logo.png`} alt="" width={109} height={80} className="h-20 w-auto" />
        <h1 className="text-2xl font-extrabold tracking-tight text-brand">Masuk ke {APP_NAME}</h1>
        <p className="text-sm text-slate-500">Cari kos terdekat, ajukan PO, dan ngobrol dengan pengelola.</p>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {user && user.needs_phone && (
        <form onSubmit={savePhone} className={`${card} space-y-3 p-4`}>
          <div className="text-sm">
            Halo <strong>{user.name}</strong>. Isi nomor HP supaya pengelola bisa menghubungimu setelah PO dibayar.
          </div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812 3456 7890" inputMode="tel" required className={input} />
          <button disabled={busy === "phone"} className={`${btnPrimary} w-full`}>
            Simpan nomor HP
          </button>
        </form>
      )}

      {user && !user.needs_phone && (
        <div className={`${card} p-4 text-sm`}>
          Kamu masuk sebagai <strong>{user.name}</strong> ({user.email}).{" "}
          <button onClick={() => router.push(next)} className="font-semibold text-brand underline">Lanjutkan</button>
        </div>
      )}

      {!user && demo && (
        <div className="space-y-3 rounded-2xl border border-gold/50 bg-gold-soft p-4">
          <div className="text-sm font-bold text-gold-dark">Mode percontohan: masuk tanpa akun Google</div>
          <button onClick={() => demoLogin("customer")} disabled={!!busy} className={`${btnPrimary} w-full py-3`}>
            {busy === "customer" ? "Masuk..." : "Masuk sebagai pencari kos"}
          </button>
          <button onClick={() => demoLogin("manager")} disabled={!!busy} className={`${btnBrandOutline} w-full py-3`}>
            {busy === "manager" ? "Masuk..." : "Masuk sebagai pengelola kos"}
          </button>
          <p className="text-xs text-gold-dark">Bergantian antara dua akun ini untuk mencoba seluruh alur: pesan, jawab, bayar, chat, deal, dan bintang.</p>
        </div>
      )}

      {!user && googleId && (
        <div className={`${card} space-y-3 p-4`}>
          <div className="text-sm text-slate-700">Masuk dengan akun Google. Tidak perlu membuat kata sandi.</div>
          <div ref={googleBox} className="flex min-h-11 justify-center" />
          {busy === "google" && <div className="text-center text-xs text-slate-500">Memeriksa akun...</div>}
        </div>
      )}

      {!user && !demo && !googleId && (
        <div className={`${card} space-y-2 p-4 text-sm text-slate-700`}>
          <p>Masuk dengan Google belum diaktifkan oleh admin.</p>
          <p className="text-xs text-slate-500">Admin mengisinya di Pengaturan, bagian Masuk dengan Google.</p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat...</div>}>
      <Login />
    </Suspense>
  );
}
