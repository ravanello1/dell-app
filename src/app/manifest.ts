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
    // Fundo branco para a tela de abertura combinar com o mármore da arte.
    background_color: "#ffffff",
    // Branco também no tema: no PWA, é o que tinge a barra de status / notch.
    theme_color: "#ffffff",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Versão com respiro nas bordas, para o aro dourado não ser cortado no
      // recorte circular/squircle que o Android aplica.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
