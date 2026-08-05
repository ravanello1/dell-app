"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Cake,
  Download,
  AtSign,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/core/utils/date";
import { whatsappLink } from "@/core/utils/phone";
import { initials, firstName } from "@/core/utils/text";
import { clientSourceLabels } from "../client.schema";
import { useArchiveClient, useEraseClient } from "../client.api";
import type { ClientDto } from "../client.dto";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import type { ReactNode } from "react";

function DataRow({
  icon,
  label,
  children,
}: {
  icon?: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {icon && <span className="mt-0.5 shrink-0 text-gold-600">{icon}</span>}
      <div className="min-w-0 flex-1">
        <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
        <dd className="mt-0.5 break-words text-sm text-ink-900">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Cidade e estado têm valor padrão (Curitiba/PR), então sozinhos não
 * significam que alguém preencheu um endereço — sem rua nem bairro, não há
 * endereço para mostrar.
 */
function formatAddress(client: ClientDto): string | null {
  if (!client.street && !client.district) return null;

  const line = [client.street, client.streetNumber].filter(Boolean).join(", ");
  const rest = [client.complement, client.district].filter(Boolean).join(" · ");
  const cityState = [client.city, client.state].filter(Boolean).join("/");
  return [line, rest, cityState].filter(Boolean).join(" — ") || null;
}

export function ClientDetail({
  client,
  canManageSensitiveData,
  isOwner,
}: {
  client: ClientDto;
  canManageSensitiveData: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const archiveMutation = useArchiveClient();
  const eraseMutation = useEraseClient();

  const address = formatAddress(client);

  const whatsappMessage = `Oi, ${firstName(client.name)}! Aqui é do Dell Beauty Studio 💛`;

  async function handleArchive() {
    try {
      await archiveMutation.mutateAsync(client.id);
      toast.success("Cliente arquivada. O histórico dela foi preservado.");
      router.push("/clientes");
      router.refresh();
    } catch {
      toast.error("Não foi possível arquivar.");
    }
  }

  async function handleErase() {
    try {
      await eraseMutation.mutateAsync(client.id);
      toast.success("Dados excluídos em definitivo.");
      router.push("/clientes");
      router.refresh();
    } catch {
      toast.error("Não foi possível excluir.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Cabeçalho da ficha ────────────────────────────────────────── */}
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-rose-200 text-xl font-semibold text-rose-700 ring-1 ring-rose-300"
          >
            {initials(client.name)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl text-ink-900">{client.name}</h2>
              {!client.active && <Badge tone="neutral">Inativa</Badge>}
              {client.age !== null && <Badge tone="gold">{client.age} anos</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink-600">
              Cliente desde {formatDate(new Date(client.createdAt))}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button asChild variant="primary" size="sm">
              <a href={whatsappLink(client.phone, whatsappMessage)} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/clientes/${client.id}/editar`}>
                <Pencil className="size-4" aria-hidden />
                Editar
              </Link>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ── Contato e endereço ────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Contato" />
        <CardBody>
          <dl className="divide-y divide-line">
            <DataRow icon={<MessageCircle className="size-[18px]" aria-hidden />} label="Telefone">
              <a
                href={whatsappLink(client.phone, whatsappMessage)}
                target="_blank"
                rel="noreferrer"
                className="text-gold-700 underline-offset-2 hover:underline"
              >
                {client.phoneFormatted}
              </a>
            </DataRow>

            {client.email && (
              <DataRow icon={<Mail className="size-[18px]" aria-hidden />} label="E-mail">
                <a
                  href={`mailto:${client.email}`}
                  className="text-gold-700 underline-offset-2 hover:underline"
                >
                  {client.email}
                </a>
              </DataRow>
            )}

            {client.instagram && (
              <DataRow icon={<AtSign className="size-[18px]" aria-hidden />} label="Instagram">
                <a
                  href={`https://instagram.com/${client.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-700 underline-offset-2 hover:underline"
                >
                  @{client.instagram}
                </a>
              </DataRow>
            )}

            {client.birthDate && (
              <DataRow icon={<Cake className="size-[18px]" aria-hidden />} label="Nascimento">
                {client.birthDate.split("-").reverse().join("/")}
              </DataRow>
            )}

            {address && (
              <DataRow icon={<MapPin className="size-[18px]" aria-hidden />} label="Endereço">
                {address}
                {client.cep && <span className="block text-ink-400">CEP {client.cep}</span>}
              </DataRow>
            )}

            {client.source && (
              <DataRow label="Como conheceu">{clientSourceLabels[client.source]}</DataRow>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* ── Observações ───────────────────────────────────────────────── */}
      {(client.notes || client.healthNotes) && (
        <Card>
          <CardHeader title="Observações" />
          <CardBody className="flex flex-col gap-4">
            {client.notes && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">Anotações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-900">
                  {client.notes}
                </p>
              </div>
            )}

            {client.healthNotes && (
              <div className="rounded-(--radius-field) border border-warning/25 bg-warning-soft p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  Saúde e alergias
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-900">
                  {client.healthNotes}
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── LGPD ──────────────────────────────────────────────────────── */}
      {canManageSensitiveData && (
        <Card>
          <CardHeader
            title="Dados pessoais"
            description="Direitos da cliente previstos na LGPD"
          />
          <CardBody className="flex flex-col gap-4">
            <div
              className={cnConsent(client.hasLgpdConsent)}
              role="status"
            >
              {client.hasLgpdConsent ? (
                <>
                  <ShieldCheck className="size-4 shrink-0" aria-hidden />
                  <span>
                    Consentimento registrado em{" "}
                    {client.lgpdConsentAt ? formatDate(new Date(client.lgpdConsentAt)) : "—"}.
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="size-4 shrink-0" aria-hidden />
                  <span>
                    Sem consentimento registrado. Peça a autorização e marque na edição da ficha.
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <a href={`/api/v1/clients/${client.id}/export`} download>
                  <Download className="size-4" aria-hidden />
                  Exportar dados
                </a>
              </Button>

              {client.active && (
                <ConfirmDialog
                  trigger={
                    <Button variant="secondary" size="sm">
                      <Archive className="size-4" aria-hidden />
                      Arquivar
                    </Button>
                  }
                  title="Arquivar cliente?"
                  description={`${client.name} sai das listas e da busca, mas o histórico de atendimentos continua guardado. Dá para reativar depois na edição da ficha.`}
                  confirmLabel="Arquivar"
                  onConfirm={handleArchive}
                />
              )}

              {isOwner && (
                <ConfirmDialog
                  trigger={
                    <Button variant="dangerGhost" size="sm">
                      <Trash2 className="size-4" aria-hidden />
                      Excluir em definitivo
                    </Button>
                  }
                  title="Excluir todos os dados?"
                  description={`Todos os dados de ${client.name} — ficha, agendamentos e fotos — serão apagados sem possibilidade de recuperação. Use quando ela pedir a exclusão pela LGPD.`}
                  confirmLabel="Excluir para sempre"
                  destructive
                  onConfirm={handleErase}
                />
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function cnConsent(hasConsent: boolean) {
  return hasConsent
    ? "flex items-center gap-2 rounded-(--radius-field) border border-success/25 bg-success-soft px-3 py-2.5 text-sm text-success"
    : "flex items-center gap-2 rounded-(--radius-field) border border-warning/25 bg-warning-soft px-3 py-2.5 text-sm text-warning";
}
