"use client";

import { useState } from "react";
import { CalendarPlus, History } from "lucide-react";
import { formatCents } from "@/core/utils/money";
import { formatDate, formatTime } from "@/core/utils/date";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { EmptyState, LoadingBlock } from "@/ui/feedback";
import { useClientHistory } from "../agenda.api";
import { statusStyles } from "../agenda.presentation";
import { AppointmentDialog } from "./appointment-dialog";
import type { AppointmentDto } from "../agenda.dto";

/**
 * Histórico de atendimentos na ficha da cliente.
 *
 * Vive no módulo da agenda, não no de clientes: quem sabe o que é um
 * atendimento é a agenda. A ficha só monta o componente — e é por isso que o
 * módulo de clientes segue sem conhecer a tabela `appointments`.
 */
export function ClientHistory({ clientId }: { clientId: string }) {
  const query = useClientHistory(clientId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentDto | undefined>();

  const appointments = query.data ?? [];
  const completed = appointments.filter((appointment) => appointment.status === "DONE");
  const totalSpent = completed.reduce((sum, appointment) => sum + appointment.priceCents, 0);

  function open(appointment?: AppointmentDto) {
    setEditing(appointment);
    setDialogOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Atendimentos"
          description={
            completed.length > 0
              ? `${completed.length} ${completed.length === 1 ? "concluído" : "concluídos"} · ${formatCents(totalSpent)} no total`
              : undefined
          }
          action={
            <Button size="sm" variant="secondary" onClick={() => open()}>
              <CalendarPlus className="size-4" aria-hidden />
              Agendar
            </Button>
          }
        />

        {query.isPending ? (
          <LoadingBlock label="Carregando histórico…" />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<History className="size-6" aria-hidden />}
            title="Nenhum atendimento ainda"
            description="Marque o primeiro horário desta cliente."
            action={
              <Button onClick={() => open()}>
                <CalendarPlus className="size-4" aria-hidden />
                Agendar
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {appointments.map((appointment) => {
              const style = statusStyles[appointment.status];
              return (
                <li key={appointment.id}>
                  <button
                    type="button"
                    onClick={() => open(appointment)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gold-50"
                  >
                    <span
                      aria-hidden
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: appointment.service.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">
                        {appointment.services && appointment.services.length > 0
                          ? appointment.services.map((s) => s.name).join(" + ")
                          : appointment.service.name}
                      </span>
                      <span className="block text-xs text-ink-600">
                        {formatDate(new Date(appointment.startAt))} às{" "}
                        {formatTime(new Date(appointment.startAt))} ·{" "}
                        {appointment.professional.name}
                      </span>
                      {appointment.notes && (
                        <span className="mt-0.5 block truncate text-xs italic text-ink-400">
                          {appointment.notes}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={style.tone}>{style.label}</Badge>
                      {appointment.priceCents > 0 && (
                        <span className="text-xs tabular-nums text-ink-600">
                          {formatCents(appointment.priceCents)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {query.isError && (
          <CardBody>
            <p className="text-sm text-danger">Não foi possível carregar o histórico.</p>
          </CardBody>
        )}
      </Card>

      <AppointmentDialog
        key={`${editing?.id ?? "novo"}-${String(dialogOpen)}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointment={editing}
        fixedClientId={editing ? undefined : clientId}
      />
    </>
  );
}
