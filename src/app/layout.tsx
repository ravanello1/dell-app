import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { studio } from "@/core/config/studio";
import { Providers } from "./providers";
import "./globals.css";

// Servidas pelo próprio domínio (next/font baixa e hospeda), o que mantém a
// CSP fechada em `font-src 'self'` e evita uma requisição a terceiros.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${studio.appName} · ${studio.name}`,
    template: `%s · ${studio.appName}`,
  },
  description: `Gestão de agenda, clientes e estoque do ${studio.name} — ${studio.city}/${studio.state}.`,
  applicationName: studio.appName,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: studio.appName,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Branco (o mesmo --color-surface da barra do topo), para a faixa do notch /
  // ilha dinâmica no app instalado ficar branca e sem emenda com o cabeçalho,
  // em vez do dourado. O texto do relógio/bateria fica escuro (status bar
  // "default"), legível sobre o branco.
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Permite ampliar: bloquear zoom é uma barreira de acessibilidade.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
