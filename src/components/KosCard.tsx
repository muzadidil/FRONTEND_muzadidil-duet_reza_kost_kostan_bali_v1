import { distance, rupiah } from "@/lib/format";
import type { KosSummary } from "@/lib/api";

export function Stars({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) return <span className="text-xs text-slate-500">Belum ada ulasan</span>;
  return (
    <span className="text-xs font-medium text-slate-700">
      <span className="text-star">★</span> {avg.toFixed(1).replace(".", ",")} <span className="font-normal text-slate-500">({count})</span>
    </span>
  );
}

const RESIDENT: Record<string, string> = { putra: "Putra", putri: "Putri", campur: "Putra-putri" };

export function Badges({ resident, sharia, extra }: { resident: string | null; sharia: boolean; extra?: string[] }) {
  const items = [resident ? RESIDENT[resident] : null, sharia ? "Syariah" : null, ...(extra ?? [])].filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <span key={t} className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-medium text-brand">{t}</span>
      ))}
    </div>
  );
}

export function KosCard({ kos, selected, onSelect }: { kos: KosSummary; selected?: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full gap-3 rounded-2xl border bg-white p-2.5 text-left shadow-sm transition hover:shadow-md ${selected ? "border-gold ring-2 ring-gold/40" : "border-slate-200 hover:border-slate-300"}`}
    >
      {kos.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={kos.thumbnail_url} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-wash text-2xl">🏠</div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate text-sm font-bold text-slate-900">{kos.name}</div>
        <Stars avg={kos.rating_avg} count={kos.rating_count} />
        <Badges resident={kos.resident_type} sharia={kos.is_sharia} />
        <div className="flex items-center justify-between text-sm">
          <span className="font-extrabold text-brand">
            {kos.starting_price ? rupiah(kos.starting_price) : "-"}
            <span className="text-xs font-normal text-slate-500">/bln</span>
          </span>
          <span className="text-xs text-slate-500">±{distance(kos.distance_m)}</span>
        </div>
      </div>
    </button>
  );
}
