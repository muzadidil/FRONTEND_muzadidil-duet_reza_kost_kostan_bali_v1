import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import "./kebijakan.css";

// Kebijakan Privasi Kosan Click. Isinya sama dengan halaman di kost.rezasku.com/kebijakan-privasi (satu sumber
// kebenaran: bila kebijakan berubah, ubah keduanya). Teksnya ada di src/content/landing/kebijakan-privasi.html.
// Dibutuhkan layar persetujuan Google: tautan privasi harus berada di domain yang sama dengan halaman utama.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ISI = fs.readFileSync(path.join(process.cwd(), "src/content/landing/kebijakan-privasi.html"), "utf8");

export const metadata: Metadata = {
  title: "Kebijakan Privasi | Kosan Click",
  description: "Kebijakan Privasi aplikasi dan situs Kosan Click (kosan.click).",
  alternates: { canonical: "https://kosan.click/kebijakan-privasi/" },
};

export default function KebijakanPrivasi() {
  return (
    <div className="kp">
      <div className="wrap">
        <header>
          <span className="dot" />
          <a href={`${BASE}/`}>Kosan Click</a>
        </header>
        <main dangerouslySetInnerHTML={{ __html: ISI }} />
        <footer>
          <a href={`${BASE}/`}>Beranda</a>
          <a href="https://kost.rezasku.com/hapus-akun">Hapus Akun</a>
        </footer>
      </div>
    </div>
  );
}
