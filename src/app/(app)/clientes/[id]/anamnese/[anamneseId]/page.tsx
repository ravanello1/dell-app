import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ensureSession } from "@/core/auth/guard";
import { isAppError } from "@/core/api/errors";
import { getClient } from "@/modules/clients/client.service";
import { getById } from "@/modules/anamnese/anamnese.service";
import { AnamneseForm } from "@/modules/anamnese/components/anamnese-form";
import { AnamneseView } from "@/modules/anamnese/components/anamnese-view";

export const metadata: Metadata = { title: "Anamnese" };

interface PageProps {
  params: Promise<{ id: string; anamneseId: string }>;
}

export default async function AnamneseDetailPage({ params }: PageProps) {
  const { id, anamneseId } = await params;
  const session = await ensureSession();

  if (session.role !== "OWNER" && session.role !== "PRO") notFound();

  let client;
  let anamnese;
  try {
    client = await getClient(id, session);
    anamnese = await getById(anamneseId, session, { withSignatures: true });
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  // Segurança de rota: a ficha tem de ser desta cliente, não de outra.
  if (anamnese.clientId !== id) notFound();

  return (
    <>
      <Link
        href={`/clientes/${id}/anamnese`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-gold-700 print:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Anamnese de {client.name}
      </Link>

      {anamnese.status === "SIGNED" ? (
        <AnamneseView anamnese={anamnese} />
      ) : (
        <AnamneseForm anamnese={anamnese} clientName={client.name} />
      )}
    </>
  );
}
