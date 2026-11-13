"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_URL, getAppConfig, getToken, type Message } from "@/lib/api";
import { dateTime } from "@/lib/format";

/**
 * Chat per PO. Dua jalur yang saling menutupi:
 * - Realtime lewat Pusher kalau admin sudah mengisinya di Pengaturan: acara "message.sent" hanya menjadi pemicu,
 *   isi pesan tetap diambil dari API (after_id), jadi isi dan penanda "pesan saya" selalu dari server.
 * - Polling: tiap 4 detik selama realtime belum tersambung (atau tidak diaktifkan), tiap 30 detik sebagai jaring
 *   pengaman setelah tersambung, karena Pusher tidak menjamin pengiriman.
 */
export function Chat({ bookingId, canWrite }: { bookingId: number; canWrite: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const lastId = useRef(0);
  const loading = useRef(false);
  const again = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    // Satu permintaan pada satu waktu. Pemicu yang datang saat sedang mengambil diulang sekali setelah selesai,
    // supaya pesan yang masuk di tengah jalan tidak menunggu putaran polling berikutnya.
    if (loading.current) {
      again.current = true;
      return;
    }
    loading.current = true;
    try {
      do {
        again.current = false;
        try {
          const res = await api<{ data: Message[] }>(`/bookings/${bookingId}/messages?after_id=${lastId.current}`);
          if (res.data.length > 0) {
            lastId.current = res.data[res.data.length - 1].id;
            setMessages((prev) => [...prev, ...res.data]);
            api(`/bookings/${bookingId}/messages/read`, { method: "POST" }).catch(() => undefined);
          }
        } catch {
          /* gangguan sesaat: coba lagi di putaran berikutnya */
        }
      } while (again.current);
    } finally {
      loading.current = false;
    }
  }, [bookingId]);

  // Komponen dibuat ulang untuk tiap PO (key pada halaman), jadi tidak perlu mengosongkan pesan di sini.
  useEffect(() => {
    load();
    const timer = setInterval(load, live ? 30000 : 4000);
    return () => clearInterval(timer);
  }, [load, live]);

  // Langganan Pusher. Gagal atau tidak aktif: polling di atas tetap berjalan.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const config = await getAppConfig();
      if (cancelled || !config?.pusher) return;

      const { default: Pusher } = await import("pusher-js");
      if (cancelled) return;

      const pusher = new Pusher(config.pusher.key, {
        cluster: config.pusher.cluster,
        channelAuthorization: {
          endpoint: `${API_URL}/broadcasting/auth`,
          transport: "ajax",
          // Token dibaca saat otorisasi, bukan saat dibuat, supaya selalu yang terbaru.
          headersProvider: () => ({ Authorization: `Bearer ${getToken() ?? ""}`, Accept: "application/json" }),
        },
      });

      pusher.connection.bind("state_change", ({ current }: { current: string }) => {
        if (!cancelled) setLive(current === "connected");
      });

      const channel = pusher.subscribe(`private-booking.${bookingId}`);
      channel.bind("message.sent", () => {
        load();
      });
      // Setelah sambung ulang, ambil yang terlewat selama terputus.
      channel.bind("pusher:subscription_succeeded", () => {
        load();
      });

      cleanup = () => {
        channel.unbind_all();
        pusher.unsubscribe(`private-booking.${bookingId}`);
        pusher.disconnect();
      };
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [bookingId, load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await api(`/bookings/${bookingId}/messages`, { method: "POST", body: { body } });
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pesan gagal terkirim.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="max-h-72 min-h-32 space-y-2 overflow-auto bg-slate-50 p-3">
        {messages.length === 0 && <p className="py-4 text-center text-xs text-slate-500">Belum ada pesan. Sapa dulu supaya janji temu jelas.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.is_mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.is_mine ? "bg-brand text-white" : "bg-white shadow-sm"}`}>
              <div className="whitespace-pre-wrap break-words">{m.body}</div>
              <div className={`mt-0.5 text-[11px] ${m.is_mine ? "text-brand-soft" : "text-slate-500"}`}>{dateTime(m.created_at)}</div>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {canWrite ? (
        <form onSubmit={send} className="flex gap-2 border-t p-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Tulis pesan..." className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
          <button disabled={sending || !text.trim()} className="rounded-lg bg-brand px-4 text-sm font-medium text-white disabled:opacity-50">Kirim</button>
        </form>
      ) : (
        <div className="border-t p-2 text-center text-xs text-slate-500">Chat sudah ditutup. Riwayat tetap bisa dibaca.</div>
      )}
      {error && <div className="border-t bg-red-50 p-2 text-xs text-red-700">{error}</div>}
    </div>
  );
}
