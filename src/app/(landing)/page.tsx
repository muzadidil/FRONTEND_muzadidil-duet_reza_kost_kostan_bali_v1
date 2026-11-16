import fs from "node:fs";
import path from "node:path";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import LandingBehavior from "./LandingBehavior";
import "./landing.css";

// Beranda Kosan Click. Desainnya adalah berkas HTML dari pemilik (16 Nov 2026), diterapkan apa adanya:
//   src/content/landing/intro.html       sprite logo + lapisan animasi pembuka
//   src/content/landing/skrip-intro.js   memutar animasi pembuka sebelum React menyala (lihat catatan di bawah)
//   src/content/landing/isi.html         header sampai footer
//   ./landing.css                        gayanya, dilingkupi .kc supaya tidak mengenai halaman lain
//   ./LandingBehavior.tsx                peta contoh yang bisa digeser dan kontrolnya
// Isi disunting langsung di berkas-berkas itu. Tombol "Cari kos" menuju /cari/ (pencarian asli situs ini).

// Font judul. Sumbu opsz dan wdth dipakai oleh font-stretch di CSS, sama dengan tautan Google Fonts aslinya.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--font-bricolage", display: "swap" });

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const baca = (nama: string) => fs.readFileSync(path.join(process.cwd(), "src/content/landing", nama), "utf8").replaceAll("{{BASE}}", BASE);

const INTRO = baca("intro.html");
const SKRIP_INTRO = baca("skrip-intro.js");
const ISI = baca("isi.html");

const DESKRIPSI = "Taruh pin di tempat kerja atau kampusmu, atur radius 1 sampai 20 km, lalu lihat kos terdekat di Bali dan pesan lewat aplikasi.";

export const metadata: Metadata = {
  title: "Kosan.click | Cari kos terdekat di Bali dari titik di peta",
  description: DESKRIPSI,
  alternates: { canonical: "https://kosan.click/" },
  // Bukti kepemilikan domain untuk Google Search Console (layar persetujuan OAuth). Jangan dihapus: Google memeriksanya
  // terus. Kode ini bukan rahasia; ia hanya mengaitkan domain dengan akun Search Console pemilik.
  verification: { google: "jhRebCOrIeDRHXj0jStTlDEsFcltSVOYXEi18WpytHk" },
  openGraph: {
    type: "website",
    siteName: "Kosan.click",
    locale: "id_ID",
    url: "https://kosan.click/",
    title: "Kosan.click | Cari kos terdekat di Bali",
    description: "Taruh pin di peta, atur radius, lihat kos terdekat, lalu pesan lewat aplikasi.",
    images: [{ url: "https://kosan.click/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

const DATA_TERSTRUKTUR = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kosan.click",
  url: "https://kosan.click/",
  description: "Cari kos terdekat di Bali dari titik yang kamu pilih di peta.",
  inLanguage: "id-ID",
});

// Skrip pembuka berjalan sinkron saat peramban membaca HTML, jadi animasi mulai sebelum halaman sempat terlihat.
// Ia mengubah DOM (membuka #intro, menambah kelas pada <html>) sebelum React menyala; suppressHydrationWarning
// membuat React menerima DOM apa adanya. Pada navigasi di dalam situs skrip ini tidak berjalan, dan itu memang
// yang diinginkan (animasi hanya sekali per sesi peramban).
export default function Beranda() {
  return (
    <div className={`kc ${bricolage.variable}`}>
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: INTRO }} />
      <script dangerouslySetInnerHTML={{ __html: SKRIP_INTRO }} />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: ISI }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: DATA_TERSTRUKTUR }} />
      <LandingBehavior />
    </div>
  );
}
