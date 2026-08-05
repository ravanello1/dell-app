import { ensureSession } from "@/core/auth/guard";
import { AppNav, AppTopBar } from "./nav";

/**
 * Shell autenticado.
 *
 * A checagem de sessão fica aqui, no layout do grupo de rotas: toda página
 * dentro de `(app)` herda a proteção sem precisar repetir a verificação — e
 * uma página nova criada amanhã já nasce protegida.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await ensureSession();

  return (
    <div className="min-h-dvh bg-surface-muted">
      {/* Navegação lateral — a partir de telas médias */}
      <AppNav session={session} />

      <div className="md:pl-60">
        <AppTopBar session={session} />

        {/* pb-24 abre espaço para a barra inferior no celular */}
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 md:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
