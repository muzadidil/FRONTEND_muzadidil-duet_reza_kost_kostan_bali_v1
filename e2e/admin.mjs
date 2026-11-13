import { chromium } from "playwright-core";
// Pakai: ADMIN_EMAIL=... ADMIN_PASSWORD=... node e2e/admin.mjs ./hasil  (akun admin dari php artisan db:seed --class=AdminSeeder)
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`${process.env.API ?? "http://127.0.0.1:8123"}/masuk`);
await p.fill("input[type=email]", process.env.ADMIN_EMAIL);
await p.fill("input[type=password]", process.env.ADMIN_PASSWORD);
await p.click("button[type=submit]");
await p.waitForURL(/dashboard/, { timeout: 20000 });
await p.waitForSelector("text=Perlu Tindakan");
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/a1-dashboard.png`, fullPage: true });
for (const [path, name, wait] of [["pesanan", "a2-pesanan", "text=Pesanan (PO)"], ["komisi", "a3-komisi", "text=Pendapatan aplikasi"], ["verifikasi", "a4-verifikasi", "text=Verifikasi Kos"], ["ulasan", "a5-ulasan", "text=Ulasan"]]) {
  await p.goto(`${process.env.API ?? "http://127.0.0.1:8123"}/${path}`);
  await p.waitForSelector(wait);
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${name}.png` });
}
console.log(errs.length ? "GALAT: " + errs.join("; ") : "admin OK");
await b.close();
