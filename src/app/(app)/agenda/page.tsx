import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/ui/card";
import { LoadingBlock } from "@/ui/feedback";
import { AgendaView } from "@/modules/agenda/components/agenda-view";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <>
      <PageHeader title="Agenda" description="Dia, semana e mês — toque num horário livre para marcar" />
      {/* AgendaView lê o estado da URL, então precisa de um limite de Suspense. */}
      <Suspense fallback={<LoadingBlock label="Carregando a agenda…" />}>
        <AgendaView />
      </Suspense>
    </>
  );
}
