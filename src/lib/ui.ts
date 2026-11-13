// Gaya yang dipakai berulang di banyak halaman, satu tempat supaya tampilan seragam dan mudah diubah.

/** Kolom isian dan pilihan. */
export const input =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10";

const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

/** Tombol utama (navy). */
export const btnPrimary = `${btn} bg-brand text-white shadow-sm hover:bg-brand-dark`;

/** Tombol pendamping (garis tipis). */
export const btnOutline = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

/** Tombol penekanan (emas), untuk satu aksi penting per layar. */
export const btnGold = `${btn} bg-gold text-brand-dark shadow-sm hover:brightness-95`;

/** Kartu putih. */
export const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";

/** Tombol kecil bergaris (mis. "Lokasi saya"). */
export const btnOutlineSm =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

/** Pilihan (select) ukuran kecil di samping tulisan. */
export const selectSm =
  "rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

/** Tombol pendamping bergaris navy, untuk pilihan kedua yang tetap penting (mis. masuk sebagai pengelola). */
export const btnBrandOutline = `${btn} border border-brand bg-white text-brand hover:bg-brand-wash`;
