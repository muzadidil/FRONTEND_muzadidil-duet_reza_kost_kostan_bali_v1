// Google Identity Services: tombol "Masuk dengan Google". Skripnya dimuat dari Google hanya di halaman masuk.

type CredentialResponse = { credential?: string };

type GoogleId = {
  initialize: (config: { client_id: string; callback: (response: CredentialResponse) => void; ux_mode?: "popup" | "redirect" }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);

  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Layanan Google tidak tersedia.")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Tidak bisa memuat Google. Periksa koneksi internet."));
    };
    document.head.appendChild(script);
  });

  return loading;
}
