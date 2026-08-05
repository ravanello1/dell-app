import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Cake,
  CalendarDays,
  CalendarPlus,
  Package,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react";
import { ensureSession } from "@/core/auth/guard";
import { studio } from "@/core/config/studio";
import { cn } from "@/core/utils/cn";
import { formatDayLong, formatTime } from "@/core/utils/date";
import { formatCents } from "@/core/utils/money";
import { whatsappLink } from "@/core/utils/phone";
import { firstName } from "@/core/utils/text";
import { getDashboard } from "@/modules/dashboard/dashboard.service";
import { statusStyles } from "@/modules/agenda/agenda.presentation";
import { buildBirthdayMessage } from "@/modules/agenda/agenda.messages";
import { productUnitLabels } from "@/modules/inventory/product.schema";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/ui/card";
import { EmptyState } from "@/ui/feedback";

export const metadata: Metadata = { title: "Hoje" };
export const dynamic = "force-dynamic";

function StatTile({
  icon,
  label,
  value,
  tone = "gold",
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "gold" | "rose" | "warning";
  href?: string;
}) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-(--radius-card) border bg-surface px-4 py-3.5 shadow-(--shadow-card)",
        href && "transition-colors hover:border-gold-400",
        tone === "warning" ? "border-warning/30" : "border-line",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          tone === "gold" && "bg-gold-50 text-gold-700 ring-1 ring-gold-200",
          tone === "rose" && "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
          tone === "warning" && "bg-warning-soft text-warning ring-1 ring-warning/25",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums leading-none text-ink-900">{value}</p>
        <p className="mt-1 truncate text-xs text-ink-600">{label}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function TodayPage() {
  const session = await ensureSession();
  const data = await getDashboard(session);
  const now = new Date();

  const upcoming = data.appointmentsToday.filter(
    (appointment) => new Date(appointment.endAt) >= now && appointment.status !== "DONE",
  );

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName(session.name)}`}
        description={`${formatDayLong(now)} · ${studio.name}`}
        action={
          <Button asChild>
            <Link href="/agenda">
              <CalendarPlus className="size-4" aria-hidden />
              Abrir agenda
            </Link>
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<CalendarDays className="size-5" aria-hidden />}
          label={data.appointmentsToday.length === 1 ? "atendimento hoje" : "atendimentos hoje"}
          value={String(data.appointmentsToday.length)}
          href="/agenda"
        />
        <StatTile
          icon={<TrendingUp className="size-5" aria-hidden />}
          label="previsto para hoje"
          value={formatCents(data.expectedRevenueCents)}
          tone="rose"
        />
        <StatTile
          icon={<Users className="size-5" aria-hidden />}
          label="clientes ativas"
          value={String(data.activeClients)}
          href="/clientes"
        />
        <StatTile
          icon={<Package className="size-5" aria-hidden />}
          label={data.lowStock.length === 1 ? "produto a repor" : "produtos a repor"}
          value={String(data.lowStock.length)}
          tone={data.lowStock.length > 0 ? "warning" : "gold"}
          href="/estoque"
        />
      </div>

      {/* `min-w-0` nas células: por padrão um item de grid tem
          `min-width: auto` e se recusa a encolher abaixo do próprio conteúdo,
          o que empurra a largura da página inteira no celular. */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Agenda do dia ──────────────────────────────────────────────── */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Agenda de hoje"
            description={
              upcoming.length > 0
                ? `${upcoming.length} ${upcoming.length === 1 ? "atendimento" : "atendimentos"} pela frente`
                : "Nada mais marcado para hoje"
            }
            action={
              <Link
                href="/agenda"
                className="flex items-center gap-1 text-sm font-medium text-gold-700 hover:underline"
              >
                Ver tudo
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />

          {data.appointmentsToday.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-6" aria-hidden />}
              title="Dia livre"
              description="Nenhum atendimento marcado para hoje."
              action={
                <Button asChild variant="secondary">
                  <Link href="/agenda">Marcar atendimento</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.appointmentsToday.map((appointment) => {
                const style = statusStyles[appointment.status];
                const isPast = new Date(appointment.endAt) < now;

                return (
                  <li key={appointment.id}>
                    <Link
                      href={`/clientes/${appointment.client.id}`}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gold-50",
                        isPast && "opacity-60",
                      )}
                    >
                      <span
                        aria-hidden
                        className="h-10 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: appointment.service.color }}
                      />
                      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                        {formatTime(new Date(appointment.startAt))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">
                          {appointment.client.name}
                        </span>
                        <span className="block truncate text-xs text-ink-600">
                          {appointment.service.name} · {appointment.professional.name}
                        </span>
                      </span>
                      <Badge tone={style.tone} className="shrink-0">
                        {style.label}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {/* ── Reposição ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Repor no estoque"
              action={
                <Link
                  href="/estoque"
                  className="text-sm font-medium text-gold-700 hover:underline"
                >
                  Ver
                </Link>
              }
            />
            {data.lowStock.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-600">Tudo acima do mínimo. </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {data.lowStock.slice(0, 6).map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink-900">{product.name}</span>
                      {product.spec && (
                        <span className="text-xs text-ink-400">{product.spec}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        product.isOut ? "text-danger" : "text-warning",
                      )}
                    >
                      {product.currentQty}
                      <span className="ml-1 text-[11px] font-normal text-ink-400">
                        {productUnitLabels[product.unit]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── Aniversariantes ──────────────────────────────────────────── */}
          {data.birthdays.length > 0 && (
            <Card>
              <CardHeader title="Aniversariantes do mês" />
              <ul className="divide-y divide-line">
                {data.birthdays.slice(0, 8).map((birthday) => (
                  <li
                    key={birthday.id}
                    className="flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Cake
                        className={cn(
                          "size-4 shrink-0",
                          birthday.isToday ? "text-rose-600" : "text-gold-500",
                        )}
                        aria-hidden
                      />
                      <span className="truncate text-sm text-ink-900">{birthday.name}</span>
                      {birthday.isToday && <Badge tone="rose">hoje</Badge>}
                    </span>

                    <a
                      href={whatsappLink(
                        birthday.phone,
                        buildBirthdayMessage(birthday.name, studio.name),
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs font-medium tabular-nums text-gold-700 hover:underline"
                    >
                      dia {birthday.day}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* O texto vai dentro de um <span>: num container flex, texto solto
              vira um filho anônimo que não encolhe e estoura a largura da tela
              no celular. */}
          {data.lowStock.length > 0 && (
            <p className="flex items-start gap-2 px-1 text-xs text-ink-600">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              <span className="min-w-0">
                O alerta usa o estoque mínimo de cada produto. Ajuste esse número na ficha do
                produto se estiver avisando cedo ou tarde demais.
              </span>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
