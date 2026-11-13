"""Membuat logo dan ikon situs web dari satu berkas logo asli (mobile/brand/logo-asli.png).

Jalankan dari folder frontend/:
    python -I brand/buat_logo.py

Hanya butuh Pillow. Yang dihasilkan (semua ditimpa):
  - public/logo.png          lambang di header situs, latar luar transparan
  - src/app/icon.png         ikon tab peramban (persegi bersudut bulat, 512 px)
  - src/app/apple-icon.png   ikon layar utama iOS (persegi penuh, 180 px)
  - src/app/favicon.ico      ikon lama untuk peramban yang meminta /favicon.ico

Sumbernya sama dengan yang dipakai aplikasi Flutter (mobile/brand/buat_ikon.py), jadi logo di web dan di HP selalu
serupa. Kalau logo asli diganti, sesuaikan POTONG: kotak yang memuat lambang saja, tanpa garis pembatas dan ikon
kasur kecil di bawahnya. Logo tidak memuat teks, jadi nama aplikasi bisa diganti tanpa membuat ulang logo.
Logo ini dirancang untuk permukaan terang: jangan taruh di latar gelap.
"""

from pathlib import Path

from PIL import Image, ImageDraw

FOLDER = Path(__file__).resolve().parent
AKAR = FOLDER.parent  # frontend/
SUMBER = AKAR.parent / "mobile" / "brand" / "logo-asli.png"

# Kotak potong lambang pada gambar asli 1536x1024 (kiri, atas, kanan, bawah). Sama dengan mobile/brand/buat_ikon.py.
POTONG = (247, 70, 1301, 843)

TINGGI_LOGO = 200  # piksel; header menampilkan sekitar 44 px, jadi cukup untuk layar 4x
AMBANG_PUTIH = 238  # saluran terendah >= ini dianggap latar putih
LEBAR_TEPI = 2  # lebar pita tepi yang dihaluskan, dalam piksel


def muat_lambang() -> Image.Image:
    im = Image.open(SUMBER).convert("RGB")
    # Latar gambar asli (254,254,254), bukan putih murni. Naikkan semua saluran 0,4% supaya jadi 255.
    tabel = [min(255, round(i * 255 / 254)) for i in range(256)]
    im = im.point(tabel * 3)
    return im.crop(POTONG)


def buat_transparan(im: Image.Image) -> Image.Image:
    """Latar putih yang tersambung ke tepi gambar jadi transparan. Putih di dalam lambang (dinding rumah, pot)
    tetap putih. Piksel di pita tepi diberi transparansi bertahap dan warnanya dilepas dari campuran putih,
    supaya tidak ada pinggiran putih di latar yang bukan putih murni."""
    w, h = im.size
    px = im.load()

    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if min(px[x, y]) >= AMBANG_PUTIH:
                mp[x, y] = 255

    for x in range(w):
        for y in (0, h - 1):
            if mp[x, y] == 255:
                ImageDraw.floodfill(mask, (x, y), 128)
    for y in range(h):
        for x in (0, w - 1):
            if mp[x, y] == 255:
                ImageDraw.floodfill(mask, (x, y), 128)

    luar = [[mp[x, y] == 128 for x in range(w)] for y in range(h)]

    def dekat_luar(x: int, y: int) -> bool:
        for dy in range(-LEBAR_TEPI, LEBAR_TEPI + 1):
            for dx in range(-LEBAR_TEPI, LEBAR_TEPI + 1):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and luar[yy][xx]:
                    return True
        return False

    hasil = Image.new("RGBA", (w, h))
    hp = hasil.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if luar[y][x]:
                hp[x, y] = (r, g, b, 0)
            elif dekat_luar(x, y):
                alfa = min(1.0, (255 - min(r, g, b)) / 40)
                if alfa <= 0:
                    hp[x, y] = (r, g, b, 0)
                elif alfa >= 1:
                    hp[x, y] = (r, g, b, 255)
                else:
                    lepas = lambda c: max(0, min(255, round((c - 255 * (1 - alfa)) / alfa)))
                    hp[x, y] = (lepas(r), lepas(g), lepas(b), round(alfa * 255))
            else:
                hp[x, y] = (r, g, b, 255)
    return hasil


def kanvas_persegi(lambang: Image.Image, ukuran: int, isi: float) -> Image.Image:
    """Kanvas persegi putih dengan lambang di tengah, lebarnya `isi` kali ukuran kanvas."""
    lebar = round(ukuran * isi)
    tinggi = round(lebar * lambang.height / lambang.width)
    kecil = lambang.resize((lebar, tinggi), Image.Resampling.LANCZOS)
    kanvas = Image.new("RGBA", (ukuran, ukuran), (255, 255, 255, 255))
    kanvas.alpha_composite(kecil, ((ukuran - lebar) // 2, (ukuran - tinggi) // 2))
    return kanvas


def bulatkan(im: Image.Image, radius_persen: float = 0.2) -> Image.Image:
    """Sudut bulat dengan garis tepi tipis supaya ikon tidak lenyap di tab yang terang."""
    s = im.width
    besar = 4
    topeng = Image.new("L", (s * besar, s * besar), 0)
    ImageDraw.Draw(topeng).rounded_rectangle([0, 0, s * besar - 1, s * besar - 1], radius=int(s * besar * radius_persen), fill=255)
    topeng = topeng.resize((s, s), Image.Resampling.LANCZOS)
    hasil = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    hasil.paste(im, (0, 0), topeng)

    tepi = Image.new("L", (s * besar, s * besar), 0)
    ImageDraw.Draw(tepi).rounded_rectangle(
        [0, 0, s * besar - 1, s * besar - 1], radius=int(s * besar * radius_persen), outline=255, width=max(1, round(s * besar * 0.012))
    )
    tepi = tepi.resize((s, s), Image.Resampling.LANCZOS)
    hasil.paste(Image.new("RGBA", (s, s), (205, 212, 224, 255)), (0, 0), tepi)
    return hasil


def main() -> None:
    lambang = muat_lambang()
    lebar = round(lambang.width * TINGGI_LOGO / lambang.height)
    kecil = lambang.resize((lebar, TINGGI_LOGO), Image.Resampling.LANCZOS)
    logo = buat_transparan(kecil)
    jalur_logo = AKAR / "public" / "logo.png"
    logo.save(jalur_logo, optimize=True)
    print(f"{jalur_logo.relative_to(AKAR)}: {logo.width}x{logo.height}px, {jalur_logo.stat().st_size // 1024} KB")

    # Untuk ikon dipakai lambang berlatar putih penuh (bukan yang transparan): bidang putih di dalam bulatan tidak berlubang.
    lambang_rgba = lambang.convert("RGBA")

    icon = bulatkan(kanvas_persegi(lambang_rgba, 512, 0.82))
    jalur = AKAR / "src" / "app" / "icon.png"
    icon.save(jalur, optimize=True)
    print(f"{jalur.relative_to(AKAR)}: 512x512px, {jalur.stat().st_size // 1024} KB")

    apple = kanvas_persegi(lambang_rgba, 180, 0.78).convert("RGB")
    jalur = AKAR / "src" / "app" / "apple-icon.png"
    apple.save(jalur, optimize=True)
    print(f"{jalur.relative_to(AKAR)}: 180x180px, {jalur.stat().st_size // 1024} KB")

    jalur = AKAR / "src" / "app" / "favicon.ico"
    icon.save(jalur, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"{jalur.relative_to(AKAR)}: 16/32/48 px, {jalur.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
