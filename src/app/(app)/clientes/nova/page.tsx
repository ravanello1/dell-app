import type { Metadata } from "next";
import { ensureSession } from "@/core/auth/guard";
import { PageHeader } from "@/ui/card";
import { ClientForm } from "@/modules/clients/components/client-form";

export const metadata: Metadata = { title: "Nova cliente" };

export default async function NewClientPage() {
  const session = await ensureSession();

  return (
    <>
      <PageHeader
        title="Nova cliente"
        description="Só nome e telefone são obrigatórios — o resto dá para completar depois"
      />
      <ClientForm canEditHealthNotes={session.role === "OWNER" || session.role === "PRO"} />
    </>
  );
}
