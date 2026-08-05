import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ensureSession } from "@/core/auth/guard";
import { isAppError } from "@/core/api/errors";
import { getClient } from "@/modules/clients/client.service";
import { ClientDetail } from "@/modules/clients/components/client-detail";
import { ClientHistory } from "@/modules/agenda/components/client-history";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await ensureSession();
  try {
    const client = await getClient(id, session);
    return { title: client.name };
  } catch {
    return { title: "Cliente" };
  }
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await ensureSession();

  // Renderizado no servidor: a ficha já chega pronta na primeira pintura, sem
  // um estado de carregamento intermediário.
  let client;
  try {
    client = await getClient(id, session);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const canManageSensitiveData = session.role === "OWNER" || session.role === "PRO";

  return (
    <>
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-gold-700"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Todas as clientes
      </Link>

      <div className="flex flex-col gap-4">
        <ClientDetail
          client={client}
          canManageSensitiveData={canManageSensitiveData}
          isOwner={session.role === "OWNER"}
        />
        <ClientHistory clientId={client.id} />
      </div>
    </>
  );
}
