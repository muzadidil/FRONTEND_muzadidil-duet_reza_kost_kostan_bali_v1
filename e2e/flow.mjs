// Uji alur lengkap di browser sungguhan: pelanggan mencari, memesan; pengelola menjawab; pelanggan bayar,
// chat, deal, bintang; pengelola memasang kos. Tangkapan layar disimpan untuk diperiksa.
//
// Pakai: server API dalam mode percontohan dengan data contoh (lihat README, bagian "Percontohan untuk investor"), lalu
//   WEB=http://127.0.0.1:8123/app CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" npm run e2e -- ./hasil
import { chromium } from "playwright-core";

const WEB = process.env.WEB ?? "http://127.0.0.1:8124";
const OUT = process.argv[2];
const log = [];
const errors = [];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

async function newUser(name, viewport) {
  const ctx = await browser.newContext({ viewport, locale: "id-ID" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("tile.openstreetmap")) errors.push(`[${name}] console: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("openstreetmap")) errors.push(`[${name}] HTTP ${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    if (!r.url().includes("openstreetmap")) errors.push(`[${name}] gagal: ${r.url()} ${r.failure()?.errorText}`);
  });
  return page;
}

const step = async (name, fn) => {
  try {
    await fn();
    log.push(`OK   ${name}`);
  } catch (e) {
    log.push(`GAGAL ${name}: ${e.message.split("\n")[0]}`);
    throw e;
  }
};

const customer = await newUser("pelanggan", { width: 1280, height: 800 });
const phone = await newUser("pelanggan-hp", { width: 390, height: 844 });
const manager = await newUser("pengelola", { width: 1280, height: 800 });

try {
  // ---------- Pencarian ----------
  await step("beranda memuat peta dan kos", async () => {
    await customer.goto(`${WEB}/cari/`);
    await customer.waitForSelector("text=kos dalam", { timeout: 20000 });
    await customer.waitForTimeout(1500);
    await customer.screenshot({ path: `${OUT}/01-beranda-desktop.png` });
  });

  await step("beranda di ponsel", async () => {
    await phone.goto(`${WEB}/cari/`);
    await phone.waitForSelector("text=kos dalam", { timeout: 20000 });
    await phone.waitForTimeout(1500);
    await phone.screenshot({ path: `${OUT}/02-beranda-ponsel.png` });
  });

  await step("pilih kos dari daftar menampilkan kartu dan garis", async () => {
    await customer.locator("button:has-text('/bln')").first().click();
    await customer.waitForSelector("text=Cek lebih detail");
    await customer.waitForTimeout(600);
    await customer.screenshot({ path: `${OUT}/03-kos-terpilih.png` });
  });

  // ---------- Detail ----------
  await step("halaman detail kos (lokasi samar)", async () => {
    await customer.click("text=Cek lebih detail");
    await customer.waitForSelector("text=Lokasi perkiraan");
    await customer.waitForSelector("text=Aturan dan fasilitas");
    await customer.waitForTimeout(1200);
    await customer.screenshot({ path: `${OUT}/04-detail.png`, fullPage: true });
    const body = await customer.textContent("body");
    if (body.includes("Jl. Contoh No.")) throw new Error("alamat asli bocor di halaman detail");
  });
  const detailUrl = customer.url();

  // ---------- Masuk sebagai pelanggan ----------
  await step("masuk percontohan sebagai pelanggan", async () => {
    await customer.goto(`${WEB}/masuk/?next=${encodeURIComponent(detailUrl.replace(WEB, ""))}`);
    await customer.waitForSelector("text=Masuk sebagai pencari kos");
    await customer.screenshot({ path: `${OUT}/05-masuk.png` });
    await customer.click("text=Masuk sebagai pencari kos");
    await customer.waitForSelector("text=Lokasi perkiraan", { timeout: 15000 });
  });

  // ---------- Ajukan PO ----------
  let kosId;
  await step("ajukan PO untuk kamar kosong", async () => {
    kosId = new URL(customer.url()).searchParams.get("id");
    await customer.locator("button:has-text('Ajukan PO')").first().click();
    await customer.waitForURL(/pesanan\/detail/, { timeout: 15000 });
    await customer.waitForSelector("text=Menunggu pengelola menjawab");
    await customer.screenshot({ path: `${OUT}/06-po-menunggu.png`, fullPage: true });
  });
  const poUrl = customer.url();
  const poId = new URL(poUrl).searchParams.get("id");

  // ---------- Pengelola menjawab ----------
  await step("pengelola menerima dan menjawab 'masih kosong'", async () => {
    await manager.goto(`${WEB}/masuk/`);
    await manager.click("text=Masuk sebagai pengelola kos");
    await manager.waitForURL(/pengelola/, { timeout: 15000 });
    await manager.waitForSelector("text=PO masuk");
    await manager.waitForTimeout(1200);
    await manager.screenshot({ path: `${OUT}/07-pengelola-kotak-masuk.png` });
    await manager.goto(`${WEB}/pesanan/detail/?id=${poId}&as=manager`);
    await manager.getByRole("button", { name: "Masih kosong" }).waitFor();
    await manager.screenshot({ path: `${OUT}/08-pengelola-jawab.png`, fullPage: true });
    await manager.getByRole("button", { name: "Masih kosong" }).click();
    await manager.waitForSelector("text=Kamu sudah memastikan kamar kosong", { timeout: 15000 });
  });

  // ---------- Pelanggan bayar (demo: langsung lunas) ----------
  await step("pelanggan membayar dan lokasi tepat terbuka", async () => {
    await customer.reload();
    await customer.waitForSelector("text=masih kosong", { timeout: 15000 });
    await customer.screenshot({ path: `${OUT}/09-po-bayar.png`, fullPage: true });
    await customer.click("button:has-text('Bayar Rp50.000')");
    await customer.waitForSelector("text=Resi pembayaran", { timeout: 15000 });
    await customer.waitForSelector("text=Lokasi kos");
    await customer.waitForTimeout(1500);
    await customer.screenshot({ path: `${OUT}/10-po-dibayar.png`, fullPage: true });
    const body = await customer.textContent("body");
    if (!body.includes("Buka rute di Google Maps")) throw new Error("tombol rute tidak ada");
  });

  // ---------- Chat ----------
  await step("chat dua arah", async () => {
    await customer.fill("input[placeholder='Tulis pesan...']", "Halo, saya mau lihat kamarnya besok pagi.");
    await customer.click("button:has-text('Kirim')");
    await customer.waitForSelector("text=Halo, saya mau lihat kamarnya besok pagi.");
    await manager.reload();
    await manager.waitForSelector("text=Halo, saya mau lihat kamarnya besok pagi.", { timeout: 15000 });
    await manager.fill("input[placeholder='Tulis pesan...']", "Silakan datang jam 9, saya tunggu di depan.");
    await manager.click("button:has-text('Kirim')");
    await customer.waitForSelector("text=Silakan datang jam 9", { timeout: 15000 });
    await customer.screenshot({ path: `${OUT}/11-chat.png`, fullPage: true });
  });

  // ---------- Deal ----------
  await step("kedua pihak konfirmasi deal", async () => {
    await customer.getByRole("button", { name: /Konfirmasi deal/ }).click();
    await customer.waitForSelector("text=Konfirmasi kamu tercatat");
    await manager.reload();
    await manager.getByRole("button", { name: /Konfirmasi deal/ }).click();
    await manager.waitForSelector("text=Deal selesai", { timeout: 15000 });
    await customer.reload();
    await customer.waitForSelector("text=Deal selesai", { timeout: 15000 });
    await customer.screenshot({ path: `${OUT}/12-deal-selesai.png`, fullPage: true });
  });

  // ---------- Bintang ----------
  await step("pelanggan memberi bintang dan tampil di kos", async () => {
    await customer.waitForSelector("text=Beri bintang untuk kos ini");
    await customer.click("button[aria-label='4 bintang']");
    await customer.fill("textarea[placeholder='Ceritakan pengalamanmu (opsional)']", "Kamar bersih, pengelola ramah.");
    await customer.click("button:has-text('Kirim ulasan')");
    await customer.waitForSelector("text=Terima kasih");
    await customer.goto(`${WEB}/kos/?id=${kosId}`);
    await customer.waitForSelector("text=Kamar bersih, pengelola ramah.", { timeout: 15000 });
    await customer.screenshot({ path: `${OUT}/13-detail-ulasan.png`, fullPage: true });
  });

  // ---------- Daftar pesanan ----------
  await step("daftar pesanan pelanggan", async () => {
    await customer.goto(`${WEB}/pesanan/`);
    await customer.waitForSelector("text=Selesai (deal)");
    await customer.screenshot({ path: `${OUT}/14-pesanan.png` });
  });

  // ---------- Pengelola memasang kos baru ----------
  await step("pengelola memasang kos baru dengan titik di peta", async () => {
    await manager.goto(`${WEB}/pengelola/kos-baru/`);
    await manager.waitForSelector("text=Pasang kos");
    await manager.waitForTimeout(1200);
    await manager.fill("input[placeholder='mis. Kos Melati']", "Kos Uji Otomatis");
    await manager.fill("textarea[placeholder^='Jl. ...']", "Jl. Uji Coba No. 1, Canggu");
    await manager.fill("input[placeholder='mis. Jalan Tukad Badung, Denpasar']", "Jalan Pantai Berawa, Canggu");
    await manager.screenshot({ path: `${OUT}/15-kos-baru.png`, fullPage: true });
    await manager.click("button:has-text('Simpan dan lanjut ke kamar')");
    await manager.waitForURL(/pengelola\/kos\/\?id=/, { timeout: 15000 });
    await manager.waitForSelector("text=Menunggu verifikasi admin");
    await manager.fill("input[placeholder='Nama / tipe kamar']", "Tipe Uji");
    await manager.fill("input[placeholder='Harga/bulan']", "1500000");
    await manager.click("button:has-text('Tambah kamar')");
    await manager.waitForSelector("text=Kamar ditambahkan.");
    await manager.screenshot({ path: `${OUT}/16-kelola-kos.png`, fullPage: true });
  });

  // ---------- Pengelola memperbaiki data ----------
  await step("pengelola mengubah harga kamar", async () => {
    await manager.getByRole("button", { name: "Ubah", exact: true }).click();
    await manager.waitForSelector("text=Ubah kamar Tipe Uji");
    // Formulir terisi nilai tersimpan, bukan kosong.
    // Formulir ubah ada di dalam daftar kamar, di atas formulir "Tambah kamar" (yang kosong).
    const price = manager.locator("input[placeholder='Harga/bulan']").first();
    if ((await price.inputValue()) !== "1500000") throw new Error("harga kamar tidak terisi dari data tersimpan");
    await price.fill("1750000");
    await manager.getByRole("button", { name: "Simpan perubahan" }).click();
    await manager.waitForSelector("text=Kamar diperbarui.");
    await manager.waitForSelector("text=/1\\.750\\.000/");
    await manager.screenshot({ path: `${OUT}/17-ubah-kamar.png`, fullPage: true });
  });

  await step("pengelola mengubah data kos", async () => {
    await manager.getByRole("button", { name: "Ubah data kos" }).click();
    const name = manager.locator("input[placeholder='mis. Kos Melati']");
    if ((await name.inputValue()) !== "Kos Uji Otomatis") throw new Error("nama kos tidak terisi dari data tersimpan");
    await name.fill("Kos Uji Otomatis Dua");
    await manager.getByRole("button", { name: "Simpan perubahan" }).click();
    await manager.waitForSelector("text=Data kos diperbarui.");
    await manager.waitForSelector("h1:has-text('Kos Uji Otomatis Dua')");
    await manager.screenshot({ path: `${OUT}/18-ubah-kos.png`, fullPage: true });
  });
} catch (e) {
  log.push(`BERHENTI: ${e.message.split("\n")[0]}`);
  for (const [name, page] of [["pelanggan", customer], ["pengelola", manager]]) {
    await page.screenshot({ path: `${OUT}/gagal-${name}.png`, fullPage: true }).catch(() => undefined);
  }
}

console.log(log.join("\n"));
if (errors.length) console.log("\nGALAT BROWSER:\n" + [...new Set(errors)].slice(0, 15).join("\n"));
await browser.close();
