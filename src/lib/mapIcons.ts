// Penanda peta, dibuat sekali di sini dan dipakai peta Google maupun peta cadangan Leaflet supaya tampilannya sama.
// Gayanya ada di globals.css (kelas kos-*). Penanda dibuat dari HTML, bukan gambar bawaan pustaka peta, supaya tidak
// bergantung pada berkas gambar yang jalurnya sering rusak di aplikasi hasil build.

export type MapEngine = "google" | "leaflet";

function anchor(engine: MapEngine, extra = ""): HTMLDivElement {
  const el = document.createElement("div");
  el.className = ["kos-anchor", engine === "leaflet" ? "kos-anchor--leaflet" : "", extra].filter(Boolean).join(" ");
  return el;
}

/** Harga kos di peta. Ujung bawah ekornya menunjuk lokasi. */
export function pillElement(engine: MapEngine, label: string, selected: boolean): HTMLElement {
  const wrap = anchor(engine);
  const pill = document.createElement("div");
  pill.className = selected ? "kos-pill kos-pill--selected" : "kos-pill";
  pill.textContent = label;
  wrap.appendChild(pill);
  return wrap;
}

/** Pin orang: titik pencarian yang bisa digeser. Pusat lingkarannya di lokasi. */
export function personElement(engine: MapEngine): HTMLElement {
  const wrap = anchor(engine, "kos-anchor--center");
  wrap.innerHTML =
    '<div class="kos-person"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z"/></svg></div>';
  return wrap;
}

/** Pin lokasi kos saat dipasang atau ditunjuk. Ujung bawahnya di lokasi. */
export function placeElement(engine: MapEngine): HTMLElement {
  const wrap = anchor(engine);
  wrap.innerHTML =
    '<svg class="kos-place" width="36" height="46" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 45S33 29.5 33 17.5C33 9 26.3 2.5 18 2.5S3 9 3 17.5C3 29.5 18 45 18 45Z" fill="#e0a82e" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="17.5" r="6" fill="#0a2a5c"/></svg>';
  return wrap;
}
