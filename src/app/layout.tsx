import type { Metadata, Viewport } from "next";
import "./globals.css";

// Tema mengikuti setelan perangkat: design system HF memakai kelas `.dark` di <html>. Dijalankan sebelum render
// supaya tidak berkedip, dan ikut berubah saat setelan perangkat berubah.
const THEME_SCRIPT = `(function(){var q=window.matchMedia("(prefers-color-scheme: dark)");function s(){document.documentElement.classList.toggle("dark",q.matches)}s();q.addEventListener("change",s)})()`;

export const metadata: Metadata = {
  title: "PlanCraft - Perencanaan & Realisasi Produksi Daging Frozen",
  description: "Aplikasi perencanaan mingguan dan tracking realisasi harian pengolahan daging frozen (1 Line, 1 Shift)",
  applicationName: "PlanCraft",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PlanCraft",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceef0" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f12" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-foreground">
        {children}
      </body>
    </html>
  );
}
