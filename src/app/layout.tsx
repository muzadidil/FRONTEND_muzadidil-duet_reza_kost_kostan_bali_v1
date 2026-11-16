import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Font yang sama dengan aplikasi Flutter (google_fonts: plusJakartaSans). Diunduh saat build dan disajikan dari situs sendiri.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

// Bawaan untuk halaman aplikasi (/cari, /masuk, dan seterusnya). Beranda dan Kebijakan Privasi memakai metadata sendiri.
export const metadata: Metadata = {
  title: "Kos-Kosan: cari kos terdekat di Bali",
  description: "Taruh pin di peta, lihat kos terdekat, lalu pesan lewat aplikasi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a2a5c",
};

// Akar hanya memegang <html> dan <body>. Header dan warna halaman aplikasi ada di (app)/layout.tsx; beranda ((landing))
// punya tampilannya sendiri. suppressHydrationWarning: skrip pembuka beranda menambah kelas "intro-on" pada <html>
// sebelum React menyala, dan itu disengaja.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
