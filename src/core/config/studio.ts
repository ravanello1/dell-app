/**
 * Identidade do studio. Seguro para importar em componentes de cliente:
 * só lê variáveis com prefixo NEXT_PUBLIC_, que o Next injeta no bundle.
 */
export const studio = {
  appName: "Dell App",
  name: process.env.NEXT_PUBLIC_STUDIO_NAME ?? "Dell Beauty Studio",
  city: process.env.NEXT_PUBLIC_STUDIO_CITY ?? "Curitiba",
  state: process.env.NEXT_PUBLIC_STUDIO_STATE ?? "PR",
  /** Todo horário exibido ao usuário é renderizado neste fuso. */
  timeZone: "America/Sao_Paulo",
  locale: "pt-BR",
  currency: "BRL",
} as const;
