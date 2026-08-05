import type { z } from "zod";
import { ConflictError, ForbiddenError, NotFoundError } from "@/core/api/errors";
import type { PageMeta } from "@/core/api/dto";
import { canDeletePermanently } from "@/core/auth/guard";
import type { SessionUser } from "@/core/auth/session";
import {
  toClientDto,
  type ClientDto,
  type ClientListItem,
  type ClientQuery,
  type createClientSchema,
  type updateClientSchema,
} from "./client.dto";
import { formatPhone } from "@/core/utils/phone";
import * as repository from "./client.repository";
import type { ClientRow } from "./client.schema";

/**
 * Regras do módulo de clientes.
 *
 * Duas decisões moram aqui e valem ser explicadas:
 *
 * 1. Telefone duplicado bloqueia o cadastro. Num studio, dois registros da
 *    mesma pessoa significam histórico partido — a manutenção fica numa ficha e
 *    o retorno na outra. O erro devolve o nome de quem já usa aquele número
 *    para a recepção decidir o que fazer.
 *
 * 2. Observações de saúde (alergias, sensibilidade) só saem para OWNER e PRO.
 *    É dado sensível sob a LGPD e a recepção não precisa dele para agendar.
 */

type CreateInput = z.output<typeof createClientSchema>;
type UpdateInput = z.output<typeof updateClientSchema>;

function canSeeHealthNotes(user: SessionUser): boolean {
  return user.role === "OWNER" || user.role === "PRO";
}

function present(row: ClientRow, user: SessionUser): ClientDto {
  return toClientDto(row, { includeHealth: canSeeHealthNotes(user) });
}

export async function listClients(
  query: ClientQuery,
  _user: SessionUser,
): Promise<{ items: ClientListItem[]; meta: PageMeta }> {
  const { rows, total } = await repository.listClients(query);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      phoneFormatted: formatPhone(row.phone),
      instagram: row.instagram,
      birthDate: row.birthDate,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    })),
    meta: {
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    },
  };
}

export async function getClient(id: string, user: SessionUser): Promise<ClientDto> {
  const row = await repository.findClientById(id);
  if (!row) throw new NotFoundError("Cliente");
  return present(row, user);
}

export async function createClient(input: CreateInput, user: SessionUser): Promise<ClientDto> {
  const duplicate = await repository.findClientByPhone(input.phone);
  if (duplicate) {
    throw new ConflictError(
      `Este telefone já está cadastrado para ${duplicate.name}.`,
      { phone: ["Telefone já cadastrado para outra cliente."] },
    );
  }

  const row = await repository.insertClient({
    name: input.name,
    phone: input.phone,
    email: input.email,
    birthDate: input.birthDate,
    instagram: input.instagram,
    cep: input.cep,
    street: input.street,
    streetNumber: input.streetNumber,
    complement: input.complement,
    district: input.district,
    city: input.city ?? "Curitiba",
    state: input.state ?? "PR",
    source: input.source,
    notes: input.notes,
    healthNotes: input.healthNotes,
    lgpdConsentAt: input.lgpdConsent ? new Date() : null,
    createdBy: user.id,
  });

  return present(row, user);
}

export async function updateClient(
  id: string,
  input: UpdateInput,
  user: SessionUser,
): Promise<ClientDto> {
  const existing = await repository.findClientById(id);
  if (!existing) throw new NotFoundError("Cliente");

  if (input.phone && input.phone !== existing.phone) {
    const duplicate = await repository.findClientByPhone(input.phone, id);
    if (duplicate) {
      throw new ConflictError(`Este telefone já está cadastrado para ${duplicate.name}.`, {
        phone: ["Telefone já cadastrado para outra cliente."],
      });
    }
  }

  // Recepção não altera o que não enxerga.
  const healthNotes = canSeeHealthNotes(user) ? input.healthNotes : undefined;

  // O consentimento carimba a data na primeira vez; retirar limpa o registro.
  let lgpdConsentAt: Date | null | undefined;
  if (input.lgpdConsent === true) {
    lgpdConsentAt = existing.lgpdConsentAt ?? new Date();
  } else if (input.lgpdConsent === false) {
    lgpdConsentAt = null;
  }

  const row = await repository.updateClient(id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.birthDate !== undefined && { birthDate: input.birthDate }),
    ...(input.instagram !== undefined && { instagram: input.instagram }),
    ...(input.cep !== undefined && { cep: input.cep }),
    ...(input.street !== undefined && { street: input.street }),
    ...(input.streetNumber !== undefined && { streetNumber: input.streetNumber }),
    ...(input.complement !== undefined && { complement: input.complement }),
    ...(input.district !== undefined && { district: input.district }),
    ...(input.city !== undefined && { city: input.city }),
    ...(input.state !== undefined && { state: input.state }),
    ...(input.source !== undefined && { source: input.source }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(healthNotes !== undefined && { healthNotes }),
    ...(input.active !== undefined && { active: input.active }),
    ...(lgpdConsentAt !== undefined && { lgpdConsentAt }),
  });

  if (!row) throw new NotFoundError("Cliente");
  return present(row, user);
}

/** Arquivar: some das listas, preserva o histórico. */
export async function archiveClient(id: string): Promise<void> {
  const removed = await repository.softDeleteClient(id);
  if (!removed) throw new NotFoundError("Cliente");
}

/**
 * Exclusão definitiva (LGPD, art. 18 — direito à eliminação).
 * Apaga a cliente e tudo que estiver ligado a ela, sem volta.
 */
export async function eraseClient(id: string, user: SessionUser): Promise<void> {
  if (!canDeletePermanently(user)) {
    throw new ForbiddenError("Apenas a proprietária pode excluir dados em definitivo.");
  }
  const removed = await repository.hardDeleteClient(id);
  if (!removed) throw new NotFoundError("Cliente");
}

/**
 * Exporta tudo que o sistema guarda sobre uma cliente (LGPD, art. 18 —
 * direito de acesso). Sai em JSON legível, pronto para entregar a ela.
 */
export async function exportClientData(id: string, user: SessionUser) {
  const row = await repository.findClientById(id);
  if (!row) throw new NotFoundError("Cliente");

  if (!canSeeHealthNotes(user)) {
    throw new ForbiddenError("Seu perfil não pode exportar a ficha completa.");
  }

  return {
    exportadoEm: new Date().toISOString(),
    exportadoPor: user.name,
    cliente: {
      nome: row.name,
      telefone: formatPhone(row.phone),
      email: row.email,
      nascimento: row.birthDate,
      instagram: row.instagram,
      endereco: {
        cep: row.cep,
        logradouro: row.street,
        numero: row.streetNumber,
        complemento: row.complement,
        bairro: row.district,
        cidade: row.city,
        estado: row.state,
      },
      comoConheceu: row.source,
      observacoes: row.notes,
      observacoesDeSaude: row.healthNotes,
      consentimentoLgpdEm: row.lgpdConsentAt?.toISOString() ?? null,
      cadastradaEm: row.createdAt.toISOString(),
      atualizadaEm: row.updatedAt.toISOString(),
    },
  };
}
