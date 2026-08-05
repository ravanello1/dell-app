import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ensureSession } from "@/core/auth/guard";
import { isAppError } from "@/core/api/errors";
import { getClient } from "@/modules/clients/client.service";
import { ClientForm } from "@/modules/clients/components/client-form";
import { PageHeader } from "@/ui/card";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await ensureSession();

  let client;
  try {
    client = await getClient(id, session);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <>
      <Link
        href={`/clientes/${client.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-gold-700"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar para a ficha
      </Link>

      <PageHeader title="Editar cliente" description={client.name} />

      <ClientForm
        client={client}
        canEditHealthNotes={session.role === "OWNER" || session.role === "PRO"}
      />
    </>
  );
}
