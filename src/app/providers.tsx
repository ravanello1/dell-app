"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

/** Registra o service worker que dá ao app a capacidade de instalar e de
 *  continuar legível sem internet. Só em produção — em dev ele atrapalharia o
 *  hot reload servindo respostas do cache. */
function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.warn("[pwa] service worker não registrado:", error);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useServiceWorker();

  // Criado dentro de estado para não vazar cache entre requisições no servidor.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Um studio pequeno: os dados mudam devagar e a rede móvel é cara.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // Não insistir em erro de permissão ou validação — só falha de rede.
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          style: {
            borderRadius: "0.75rem",
            fontFamily: "var(--font-inter)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
