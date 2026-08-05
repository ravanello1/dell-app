import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ensureSession } from "@/core/auth/guard";
import { isAppError } from "@/core/api/errors";
import { getClient } from "@/modules/clients/client.service";
import { listByClient } from "@/modules/anamnese/anamnese.service";
import { AnamneseList } from "@/modules/anamnese/components/anamnese-list";

export const metadata: Metadata = { title: "Anamnese" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientAnamnesePage({ params }: PageProps) {
  const { id } = await params;
  const session = await ensureSession();

  // Anamnese é dado de saúde: a recepção não entra.
  if (session.role !== "OWNER" && session.role !== "PRO") notFound();

  let client;
  let items;
  try {
    client = await getClient(id, session);
    items = await listByClient(id, session);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <>
      <Link
        href={`/clientes/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-gold-700"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Ficha de {client.name}
      </Link>

      <div className="mb-4">
        <h1 className="font-display text-2xl text-ink-900">Anamnese</h1>
        <p className="text-sm text-ink-500">Fichas de saúde e consentimento de {client.name}</p>
      </div>

      <AnamneseList clientId={id} initialItems={items} />
    </>
  );
}
