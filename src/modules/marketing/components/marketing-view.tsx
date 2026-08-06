"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Cake,
  Clock,
  Megaphone,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { formatDate } from "@/core/utils/date";
import { whatsappLink } from "@/core/utils/phone";
import { cn } from "@/core/utils/cn";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardBody } from "@/ui/card";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Field, Select } from "@/ui/field";
import {
  birthdayTemplates,
  fillTemplate,
  generalTemplates,
  winbackTemplates,
  type MessageTemplate,
} from "../marketing.templates";
import { DEFAULT_WINBACK_DAYS, type MarketingClient, type MarketingData, type PromotionDto } from "../marketing.dto";
import { useDeletePromotion } from "../marketing.api";
import { PromotionDialog } from "./promotion-dialog";

type Tab = "aniversarios" | "sumidas" | "todas" | "promocoes";

const TABS: { id: Tab; label: string; icon: typeof Cake }[] = [
  { id: "aniversarios", label: "Aniversariantes", icon: Cake },
  { id: "sumidas", label: "Sumidas", icon: Clock },
  { id: "todas", label: "Todas", icon: Users },
  { id: "promocoes", label: "Promoções", icon: Megaphone },
];

const WINBACK_OPTIONS = [30, 45, 60, 90];

export function MarketingView({ data }: { data: MarketingData }) {
  const [tab, setTab] = useState<Tab>("aniversarios");

  return (
    <div className="flex flex-col gap-4">
      {/* Abas */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count =
            t.id === "aniversarios"
              ? data.birthdays.length
              : t.id === "todas"
                ? data.all.length
                : t.id === "promocoes"
                  ? data.promotions.length
                  : undefined;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-rose-600 text-white"
                  : "bg-surface text-ink-600 ring-1 ring-inset ring-line-strong hover:bg-gold-50",
              )}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
              {count !== undefined && (
                <span className={cn("text-xs", active ? "text-white/80" : "text-ink-400")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "aniversarios" && (
        <SegmentPanel
          clients={data.birthdays}
          templates={birthdayTemplates}
          promotions={data.promotions}
          emptyLabel="Nenhuma aniversariante este mês."
          secondary={(c) => (c.isBirthdayToday ? "🎂 É hoje!" : `Dia ${c.birthdayDay}`)}
        />
      )}

      {tab === "sumidas" && <WinbackPanel data={data} />}

      {tab === "todas" && (
        <SegmentPanel
          clients={data.all}
          templates={generalTemplates}
          promotions={data.promotions}
          emptyLabel="Nenhuma cliente cadastrada."
          secondary={(c) =>
            c.lastVisitAt ? `Última visita ${formatDate(new Date(c.lastVisitAt))}` : "Nunca veio"
          }
        />
      )}

      {tab === "promocoes" && <PromotionsPanel promotions={data.promotions} />}
    </div>
  );
}

/** Painel de "Sumidas": deriva o grupo pelo seletor de dias, na hora. */
function WinbackPanel({ data }: { data: MarketingData }) {
  const [days, setDays] = useState(DEFAULT_WINBACK_DAYS);

  const inactive = useMemo(() => {
    const cutoff = data.nowMs - days * 86_400_000;
    return data.all
      .filter((c) => new Date(c.lastVisitAt ?? c.createdAt).getTime() < cutoff)
      .sort((a, b) =>
        (a.lastVisitAt ?? a.createdAt).localeCompare(b.lastVisitAt ?? b.createdAt),
      );
  }, [data.all, data.nowMs, days]);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Sem vir há mais de">
        <Select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          className="max-w-40"
        >
          {WINBACK_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} dias
            </option>
          ))}
        </Select>
      </Field>

      <SegmentPanel
        clients={inactive}
        templates={winbackTemplates}
        promotions={data.promotions}
        emptyLabel={`Nenhuma cliente sumida há mais de ${days} dias. 🎉`}
        secondary={(c) =>
          c.lastVisitAt ? `Última visita ${formatDate(new Date(c.lastVisitAt))}` : "Nunca veio"
        }
      />
    </div>
  );
}

/** Escolhe a mensagem e lista as clientes, cada uma com um botão de WhatsApp. */
function SegmentPanel({
  clients,
  templates,
  promotions,
  emptyLabel,
  secondary,
}: {
  clients: MarketingClient[];
  templates: MessageTemplate[];
  promotions: PromotionDto[];
  emptyLabel: string;
  secondary: (client: MarketingClient) => string;
}) {
  // Mensagens prontas do grupo + promoções ativas, no mesmo seletor.
  const options: MessageTemplate[] = useMemo(
    () => [
      ...templates,
      ...promotions
        .filter((p) => p.active)
        .map((p) => ({ id: `promo-${p.id}`, label: `Promoção: ${p.title}`, body: p.message })),
    ],
    [templates, promotions],
  );

  const [messageId, setMessageId] = useState(options[0]?.id ?? "");
  const message = options.find((o) => o.id === messageId) ?? options[0];

  if (clients.length === 0) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-ink-500">{emptyLabel}</CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-col gap-3">
          <Field label="Mensagem a enviar">
            <Select value={messageId} onChange={(e) => setMessageId(e.target.value)}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {message && (
            <p className="rounded-(--radius-field) bg-surface-muted p-3 text-xs leading-relaxed text-ink-600">
              {fillTemplate(message.body, "Camila")}
            </p>
          )}
          <p className="text-xs text-ink-400">
            Cada botão abre o WhatsApp da cliente com a mensagem pronta — você confere e envia.
          </p>
        </CardBody>
      </Card>

      <ul className="flex flex-col gap-2">
        {clients.map((client) => (
          <li
            key={client.id}
            className="flex items-center gap-3 rounded-(--radius-card) border border-line bg-surface p-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{client.name}</p>
              <p className="text-xs text-ink-500">{secondary(client)}</p>
            </div>
            <Button asChild variant="primary" size="sm">
              <a
                href={
                  message
                    ? whatsappLink(client.phone, fillTemplate(message.body, client.name))
                    : whatsappLink(client.phone)
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Gerência das promoções salvas. O envio acontece pelos grupos (o seletor de
 *  mensagens de cada grupo já lista as promoções ativas). */
function PromotionsPanel({ promotions }: { promotions: PromotionDto[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionDto | undefined>(undefined);
  const deleteMutation = useDeletePromotion();

  function openNew() {
    setEditing(undefined);
    setDialogOpen(true);
  }
  function openEdit(promotion: PromotionDto) {
    setEditing(promotion);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Promoção removida.");
    } catch {
      toast.error("Não foi possível remover.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          Crie promoções aqui; envie-as pelos grupos (aparecem no seletor de mensagens).
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" aria-hidden />
          Nova promoção
        </Button>
      </div>

      {promotions.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-gold-50 text-gold-600">
              <Megaphone className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-ink-500">
              Nenhuma promoção ainda. Crie uma para reutilizar nas mensagens.
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {promotions.map((promotion) => (
            <li key={promotion.id}>
              <Card>
                <CardBody className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">{promotion.title}</p>
                      {promotion.active ? (
                        <Badge tone="success">Ativa</Badge>
                      ) : (
                        <Badge tone="neutral">Inativa</Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-600">{promotion.message}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(promotion)}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="dangerGhost" size="sm">
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      }
                      title="Remover promoção?"
                      description={`"${promotion.title}" será removida. As mensagens já enviadas não são afetadas.`}
                      confirmLabel="Remover"
                      destructive
                      onConfirm={() => handleDelete(promotion.id)}
                    />
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <PromotionDialog
        key={editing?.id ?? "nova"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        promotion={editing}
      />
    </div>
  );
}
