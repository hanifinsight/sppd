import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SPPD | Perjalanan Dinas",
  description: "Sistem informasi perjalanan dinas Sekretariat Daerah"
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}