import { Shell } from "@/components/Shell";

// Halaman aplikasi: header biru tua dan emas, latar abu muda. Dulu ini ada di layout akar.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50 text-slate-800">
      <Shell>{children}</Shell>
    </div>
  );
}
