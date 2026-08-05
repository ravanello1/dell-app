"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { ChevronDown, ClipboardList, FileText, Plus, TriangleAlert } from "lucide-react";
import { formatDate, formatDateTime } from "@/core/utils/date";
import { cn } from "@/core/utils/cn";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardBody } from "@/ui/card";
import { anamneseProcedures } from "../anamnese.schema";
import { procedureDescriptions, procedureLabels } from "../anamnese.questions";
import { useClientAnamneses, useCreateAnamnese } from "../anamnese.api";
import type { AnamneseListItem } from "../anamnese.dto";
import type { AnamneseProcedure } from "../anamnese.schema";

/**
 * Histórico de fichas de uma cliente + menu para abrir uma nova por procedimento.
 *
 * Recebe a primeira leitura já pronta do servidor (`initialItems`) para a lista
 * aparecer sem piscar, e a partir daí o TanStack Query mantém em dia.
 */
export function AnamneseList({
  clientId,
  initialItems,
}: {
  clientId: string;
  initialItems: AnamneseListItem[];
}) {
  const router = useRouter();
  const { data: items = initialItems } = useClientAnamneses(clientId);
  const createMutation = useCreateAnamnese(clientId);

  async function handleNew(procedure: AnamneseProcedure) {
    try {
      const created = await createMutation.mutateAsync({ procedure });
      router.push(`/clientes/${clientId}/anamnese/${created.id}`);
    } catch {
      toast.error("Não foi possível abrir uma nova ficha.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          {items.length === 0
            ? "Nenhuma ficha ainda."
            : `${items.length} ${items.length === 1 ? "ficha" : "fichas"} no histórico.`}
        </p>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="sm" loading={createMutation.isPending}>
              <Plus className="size-4" aria-hidden />
              Nova anamnese
              <ChevronDown className="size-4 opacity-80" aria-hidden />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-72 overflow-hidden rounded-(--radius-card) border border-line bg-surface p-1.5 shadow-(--shadow-card)"
            >
              <p className="px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">
                Escolha o procedimento
              </p>
              {anamneseProcedures.map((procedure) => (
                <DropdownMenu.Item
                  key={procedure}
                  onSelect={() => handleNew(procedure)}
                  className="flex cursor-pointer flex-col gap-0.5 rounded-(--radius-field) px-2.5 py-2 outline-none transition-colors focus:bg-gold-50 data-[highlighted]:bg-gold-50"
                >
                  <span className="text-sm font-medium text-ink-900">
                    {procedureLabels[procedure]}
                  </span>
                  <span className="text-xs text-ink-500">{procedureDescriptions[procedure]}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-gold-50 text-gold-600">
              <ClipboardList className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-ink-800">Sem anamnese preenchida</p>
              <p className="mt-0.5 text-sm text-ink-500">
                Abra a primeira ficha para registrar saúde, alergias e o consentimento da cliente.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/clientes/${clientId}/anamnese/${item.id}`}
                className="flex items-center gap-3 rounded-(--radius-card) border border-line bg-surface p-4 transition-colors hover:border-gold-400 hover:bg-gold-50/40"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    item.status === "SIGNED"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-gold-50 text-gold-600",
                  )}
                >
                  <FileText className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink-900">
                      {procedureLabels[item.procedure]}
                    </span>
                    {item.status === "SIGNED" ? (
                      <Badge tone="success">Assinada</Badge>
                    ) : item.clientSubmittedAt ? (
                      <Badge tone="rose">Aguardando você</Badge>
                    ) : (
                      <Badge tone="gold">Rascunho</Badge>
                    )}
                    {item.answeredYesCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                        <TriangleAlert className="size-3.5" aria-hidden />
                        {item.answeredYesCount} p/ atenção
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {item.status === "SIGNED" && item.signedAt
                      ? `Assinada em ${formatDateTime(new Date(item.signedAt))}`
                      : item.clientSubmittedAt
                        ? `Preenchida pela cliente em ${formatDateTime(new Date(item.clientSubmittedAt))}`
                        : `Criada em ${formatDate(new Date(item.createdAt))}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
