import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

// Font yang sama dengan aplikasi Flutter (google_fonts: plusJakartaSans). Diunduh saat build dan disajikan dari situs sendiri.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "Kos-Kosan: cari kos terdekat di Bali",
  description: "Taruh pin di peta, lihat kos terdekat, lalu pesan lewat aplikasi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a2a5c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 font-sans text-slate-800">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
