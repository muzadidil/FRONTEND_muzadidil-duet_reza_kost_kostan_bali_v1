import NextLink from "next/link";
import type { ComponentProps } from "react";

// Prefetch dimatikan: pada ekspor statis dengan trailingSlash, berkas prefetch RSC diminta dengan nama yang
// tidak cocok dengan hasil build dan menjawab 404. Navigasi tetap jalan (halaman dimuat penuh), hanya tanpa
// permintaan sia-sia yang memenuhi log server.
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
