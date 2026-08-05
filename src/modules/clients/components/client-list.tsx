"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Cake, ChevronRight, Search, UserPlus, Users, X } from "lucide-react";
import { initials } from "@/core/utils/text";
import { cn } from "@/core/utils/cn";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/ui/feedback";
import { useClientList } from "../client.api";
import type { ClientListItem } from "../client.dto";

/** Aniversário no mês corrente — a ficha ganha um selo e vira gancho de contato. */
function birthdayThisMonth(birthDate: string | null): boolean {
  if (!birthDate) return false;
  const month = birthDate.slice(5, 7);
  return month === String(new Date().getMonth() + 1).padStart(2, "0");
}

function ClientRow({ client }: { client: ClientListItem }) {
  return (
    <Link
      href={`/clientes/${client.id}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors",
        "hover:bg-gold-50 focus-visible:bg-gold-50",
      )}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
      >
        {initials(client.name)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-ink-900">{client.name}</span>
          {birthdayThisMonth(client.birthDate) && (
            <Badge tone="gold" className="shrink-0">
              <Cake className="size-3" aria-hidden />
              Aniversário
            </Badge>
          )}
          {!client.active && (
            <Badge tone="neutral" className="shrink-0">
              Inativa
            </Badge>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-sm text-ink-600">
          <span>{client.phoneFormatted}</span>
          {client.instagram && (
            <span className="truncate text-ink-400">@{client.instagram}</span>
          )}
        </span>
      </span>

      <ChevronRight className="size-5 shrink-0 text-gold-500" aria-hidden />
    </Link>
  );
}

export function ClientList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);

  // Adia a busca em relação ao que se digita: a lista não recarrega a cada tecla.
  const deferredSearch = useDeferredValue(search);

  const query = useClientList({
    q: deferredSearch || undefined,
    page,
    perPage: 20,
    includeInactive,
    sort: "name",
  });

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-gold-600"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Buscar por nome ou telefone…"
            aria-label="Buscar cliente"
            className={cn(
              "w-full rounded-(--radius-field) border border-line-strong bg-surface",
              "py-2.5 pl-10 pr-10 text-[16px] leading-tight text-ink-900 sm:text-sm",
              "placeholder:text-ink-400",
              "focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200",
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-400 hover:bg-gold-50 hover:text-gold-700"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        <label className="flex shrink-0 cursor-pointer items-center gap-2 px-1 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => {
              setIncludeInactive(event.target.checked);
              setPage(1);
            }}
            className="size-4 rounded border-line-strong accent-rose-600"
          />
          Mostrar inativas
        </label>
      </div>

      {query.isError && (
        <ErrorState
          message={query.error.message}
          retry={
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      )}

      <Card className="overflow-hidden">
        {query.isPending ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : query.data && query.data.items.length > 0 ? (
          <div className="divide-y divide-line">
            {query.data.items.map((client) => (
              <ClientRow key={client.id} client={client} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title={search ? "Nenhuma cliente encontrada" : "Sua lista está vazia"}
            description={
              search
                ? `Nada corresponde a "${search}". Confira a grafia ou cadastre uma nova cliente.`
                : "Cadastre a primeira cliente para começar a montar a agenda."
            }
            action={
              <Button asChild>
                <Link href="/clientes/nova">
                  <UserPlus className="size-4" aria-hidden />
                  Nova cliente
                </Link>
              </Button>
            }
          />
        )}
      </Card>

      {query.data && query.data.meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginação">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <p className="text-sm text-ink-600">
            Página {query.data.meta.page} de {query.data.meta.totalPages}
            <span className="ml-2 text-ink-400">({query.data.meta.total} clientes)</span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= query.data.meta.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}
    </div>
  );
}
