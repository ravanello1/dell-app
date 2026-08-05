import type { MetadataRoute } from "next";
import { studio } from "@/core/config/studio";

/**
 * Manifesto do PWA — é o que transforma o site em app instalável, tanto no
 * Android (ícone na gaveta, sem barra do navegador) quanto no desktop e no iOS
 * via "Adicionar à Tela de Início".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${studio.appName} — ${studio.name}`,
    short_name: studio.appName,
    description: `Agenda, clientes e estoque do ${studio.name}, em ${studio.city}/${studio.state}.`,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#faf7f2",
    theme_color: "#c9a227",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Agenda de hoje",
        short_name: "Agenda",
        description: "Abrir os atendimentos do dia",
        url: "/agenda",
      },
      {
        name: "Nova cliente",
        short_name: "Nova cliente",
        description: "Cadastrar uma cliente",
        url: "/clientes/nova",
      },
      {
        name: "Estoque",
        short_name: "Estoque",
        description: "Conferir produtos e reposição",
        url: "/estoque",
      },
    ],
  };
}
