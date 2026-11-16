// Menguji logika sambungan peta Google di situs dengan TIRUAN API Google, jadi tidak butuh kunci asli.
//
// Yang diuji: pemilihan mesin peta, penanda dan klik, geser pin, garis, klik peta di formulir, dan perpindahan otomatis
// ke peta cadangan (OpenStreetMap) saat Google menolak kunci atau gambar peta tidak kunjung termuat.
// Yang TIDAK teruji: tampilan peta Google yang sebenarnya. Itu harus dilihat dengan kunci browser asli.
//
// Pakai (server API dalam mode percontohan seperti e2e/flow.mjs; kunci browser TIDAK perlu diisi di Pengaturan, karena
// skrip ini menyisipkannya sendiri ke jawaban /api/app-config di peramban uji):
//   WEB=http://127.0.0.1:8123/app CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" npm run e2e:peta
// Satu skenario saja: npm run e2e:peta -- normal   (pilihan: normal, tolak, lambat, form)
import { chromium } from "playwright-core";

const WEB = process.env.WEB ?? "http://127.0.0.1:8124";
const MODE = process.argv[2] ?? "semua";
const KUNCI_UJI = "AIza-KUNCI-UJI-TIRUAN";

// Tiruan google.maps: hanya yang dipakai kode situs. Menggantikan https://maps.googleapis.com/maps/api/js.
// perilaku: "normal" (gambar peta termuat), "tolak" (Google memanggil gm_authFailure), "lambat" (gambar peta tak termuat).
const tiruan = (perilaku) => `
(() => {
  const mock = { maps: [], markers: [], circles: [], polylines: [], fitBounds: 0 };
  window.__mock = mock;
  class Peta {
    constructor(el, opts) { this.el = el; this.opts = opts; this.h = {}; this.center = opts.center; el.classList.add("mock-gmap"); el.style.background = "#cde"; el.style.position = "absolute"; el.textContent = "";
      mock.maps.push(this);
      ${perilaku === "normal" ? 'setTimeout(() => this.fire("tilesloaded"), 150);' : ""} }
    addListener(n, f) { (this.h[n] ||= []).push(f); return { remove() {} }; }
    fire(n, a) { (this.h[n] || []).forEach((f) => f(a)); }
    setCenter(c) { this.center = c; }
    fitBounds() { mock.fitBounds++; }
  }
  class Penanda {
    constructor(o) { this.opts = o; this.h = {}; this._map = o.map; this._position = o.position; mock.markers.push(this);
      this.el = o.content; this.el.style.position = "absolute"; this.el.style.zIndex = "5";
      const i = mock.markers.length; this.el.style.left = (o.gmpDraggable ? 10 : 40 + i * 78) + "px"; this.el.style.top = (o.gmpDraggable ? 40 : 140) + "px";
      this.el.addEventListener("click", () => (this.h.click || []).forEach((f) => f()));
      if (o.map) o.map.el.appendChild(this.el); }
    set map(v) { this._map = v; if (!v) this.el.remove(); }
    get map() { return this._map; }
    set position(p) { this._position = p; }
    get position() { return this._position; }
    addListener(n, f) { (this.h[n] ||= []).push(f); return { remove() {} }; }
    fire(n) { (this.h[n] || []).forEach((f) => f()); }
  }
  class Lingkaran { constructor(o) { this.opts = o; mock.circles.push(this); } setMap() {} }
  class Garis { constructor(o) { this.opts = o; mock.polylines.push(this); } setMap() {} }
  class Batas { extend() {} }
  window.google = { maps: {
    importLibrary: async (n) => n === "maps" ? { Map: Peta, Circle: Lingkaran, Polyline: Garis } : n === "core" ? { LatLngBounds: Batas } : { AdvancedMarkerElement: Penanda },
    event: { clearInstanceListeners() {} },
  } };
  ${perilaku === "tolak" ? "setTimeout(() => window.gm_authFailure && window.gm_authFailure(), 300);" : ""}
  window.__kosGoogleMapsSiap && window.__kosGoogleMapsSiap();
})();
`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let gagal = 0;
const ok = (nama, cond, extra = "") => {
  if (!cond) gagal++;
  console.log(`${cond ? "OK   " : "GAGAL"} ${nama}${extra ? ` (${extra})` : ""}`);
};

async function halaman(perilaku, ukuran = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport: ukuran, locale: "id-ID" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Kunci browser disisipkan ke pengaturan publik; skrip Google diganti tiruan.
  await page.route("**/api/app-config", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.maps = { ...json.maps, browser_key: KUNCI_UJI };
    await route.fulfill({ response: res, json });
  });
  await page.route(/maps\.googleapis\.com\/maps\/api\/js/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: tiruan(perilaku) }));
  return { page, errors };
}

const jalan = (nama) => MODE === "semua" || MODE === nama;

try {
  if (jalan("normal")) {
    const { page, errors } = await halaman("normal");
    await page.goto(`${WEB}/cari/`);
    await page.waitForSelector(".mock-gmap", { timeout: 15000 });
    ok("kunci browser ada: mesin Google dipilih (bukan Leaflet)", (await page.locator(".leaflet-container").count()) === 0);
    await page.waitForFunction(() => window.__mock.markers.filter((m) => !m.opts.gmpDraggable).length >= 3, null, { timeout: 15000 });
    const info = await page.evaluate(() => ({
      mapId: window.__mock.maps[0].opts.mapId,
      gesture: window.__mock.maps[0].opts.gestureHandling,
      pillCount: window.__mock.markers.filter((m) => !m.opts.gmpDraggable).length,
      pin: window.__mock.markers.find((m) => m.opts.gmpDraggable)?.opts.title,
    }));
    ok("peta dibuat dengan mapId dan gesture 'greedy'", info.mapId === "DEMO_MAP_ID" && info.gesture === "greedy", `${info.mapId}, ${info.gesture}`);
    ok("penanda harga dibuat untuk tiap kos", info.pillCount >= 3, `${info.pillCount} penanda`);
    ok("pin pencarian ada dan bisa digeser", info.pin === "Titik pencarian");
    ok("peta tampil setelah 'tilesloaded'", (await page.locator(".mock-gmap").evaluate((el) => getComputedStyle(el).visibility)) === "visible");

    // Klik penanda harga: kos terpilih (panel ringkasan muncul) dan garis putus-putus ke kos dibuat.
    await page.locator(".kos-pill").first().click();
    await page.waitForSelector("text=Cek lebih detail", { timeout: 8000 });
    ok("klik penanda memilih kos (panel 'Cek lebih detail' muncul)", true);
    await page.waitForFunction(() => document.querySelectorAll(".kos-pill--selected").length === 1, null, { timeout: 8000 });
    ok("penanda terpilih bergaya emas (kos-pill--selected)", true);
    ok("garis putus-putus pin-ke-kos digambar", (await page.evaluate(() => window.__mock.polylines.at(-1)?.opts.icons?.length ?? 0)) === 1);

    // Geser pin (dragend): pencarian kos diulang di titik baru.
    const permintaan = page.waitForRequest((r) => /kos\/nearby\?lat=-8\.6913/.test(r.url()), { timeout: 10000 });
    await page.evaluate(() => {
      const pin = window.__mock.markers.find((m) => m.opts.gmpDraggable);
      pin.position = { lat: -8.6913, lng: 115.1683 };
      pin.fire("dragend");
    });
    await permintaan;
    ok("geser pin memuat ulang kos di titik baru", true);
    ok("tidak ada galat halaman", errors.length === 0, errors.join(" | ").slice(0, 120));
  }

  if (jalan("tolak")) {
    const { page } = await halaman("tolak");
    await page.goto(`${WEB}/cari/`);
    await page.waitForSelector(".leaflet-container", { timeout: 15000 });
    ok("Google menolak kunci (gm_authFailure): beralih ke peta cadangan", true);
    ok("peta Google tidak tersisa di halaman", (await page.locator(".mock-gmap").count()) === 0);
  }

  if (jalan("lambat")) {
    const { page } = await halaman("lambat");
    await page.goto(`${WEB}/cari/`);
    await page.waitForSelector(".mock-gmap", { state: "attached", timeout: 15000 });
    ok("peta Google dibuat tetapi gambar petanya tidak kunjung termuat: tetap tersembunyi", (await page.locator(".mock-gmap").evaluate((el) => getComputedStyle(el).visibility)) === "hidden");
    await page.waitForSelector(".leaflet-container", { timeout: 15000 });
    ok("lewat batas waktu 10 detik: beralih ke peta cadangan", true);
  }

  if (jalan("form")) {
    // Formulir ubah kos: klik peta memindahkan pin; peringatan verifikasi ulang muncul bila pin jauh dari titik semula.
    const { page } = await halaman("normal", { width: 1280, height: 1400 });
    await page.goto(`${WEB}/masuk/`);
    await page.click("text=Masuk sebagai pengelola kos");
    await page.waitForURL(/pengelola/, { timeout: 15000 });
    await page.getByRole("button", { name: /Kos saya/ }).click();
    // Peringatan verifikasi ulang hanya berlaku untuk kos yang sudah terverifikasi, jadi pilih yang berlencana "Terverifikasi".
    await page.locator("div.rounded-xl", { hasText: "Terverifikasi" }).locator("a[href*='pengelola/kos/?id=']").first().click();
    await page.getByRole("button", { name: "Ubah data kos" }).click();
    await page.waitForSelector(".mock-gmap", { timeout: 15000 });
    await page.waitForFunction(() => window.__mock.markers.some((m) => m.opts.title === "Lokasi kos"), null, { timeout: 15000 });
    ok("formulir kos: pin lokasi (bentuk pin emas) dibuat di peta Google", true);
    ok("formulir kos: tidak ada peringatan sebelum pin digeser", (await page.locator("text=hilang dari pencarian").count()) === 0);
    await page.evaluate(() => window.__mock.maps[0].fire("click", { latLng: { lat: () => -8.5, lng: () => 115.3 } }));
    await page.waitForSelector("text=hilang dari pencarian", { timeout: 8000 });
    ok("formulir kos: klik peta jauh memindahkan pin dan memunculkan peringatan verifikasi ulang", true);
  }
} catch (e) {
  gagal++;
  console.log(`BERHENTI: ${e.message.split("\n")[0]}`);
}

await browser.close();
console.log(gagal === 0 ? "\nSemua lulus." : `\n${gagal} pemeriksaan gagal.`);
process.exitCode = gagal === 0 ? 0 : 1;
