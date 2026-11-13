import type { NextConfig } from "next";

// Situs statis: semua halaman dirender di browser dan memanggil API Laravel, jadi bisa dilayani dari hosting biasa
// tanpa Node.js. Halaman dengan data dinamis memakai query (?id=) bukan segmen URL, karena ekspor statis tidak
// bisa membuat halaman untuk id yang belum diketahui saat build.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Situs dilayani dari subfolder aplikasi Laravel (mis. https://demo.example.com/app/), jadi semua alamat
  // diawali basePath. Kosong = di akar domain.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
