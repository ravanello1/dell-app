import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/guard";
import { studio } from "@/core/config/studio";
import { DellMark } from "@/ui/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  // Quem já tem sessão válida — conferida no banco — não precisa ver esta tela.
  if (await getCurrentUser()) redirect("/");

  const { motivo } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <DellMark className="size-16" />
          <h1 className="mt-4 text-3xl text-ink-900">
            Dell <span className="text-gold-700">App</span>
          </h1>
          <p className="mt-1 text-sm text-ink-600">{studio.name}</p>
          <p className="text-xs text-ink-400">
            {studio.city} · {studio.state}
          </p>
        </div>

        {motivo === "sessao-invalida" && (
          <p
            role="status"
            className="mb-4 rounded-(--radius-field) border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-ink-700"
          >
            Sua sessão não vale mais neste dispositivo. Entre novamente.
          </p>
        )}

        <div className="rounded-(--radius-card) border border-line bg-surface p-5 shadow-(--shadow-card) sm:p-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-400">
          Este sistema guarda dados pessoais de clientes.
          <br />
          O acesso é individual e registrado.
        </p>
      </div>
    </main>
  );
}
