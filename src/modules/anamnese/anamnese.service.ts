import { BadRequestError, ForbiddenError, NotFoundError } from "@/core/api/errors";
import type { SessionUser } from "@/core/auth/session";
import { findClientById } from "@/modules/clients/client.repository";
import {
  buildSignatureSnapshot,
  toAnamneseDto,
  toAnamneseListItem,
  type AnamneseDto,
  type AnamneseListItem,
  type SaveAnamneseInput,
  type SignAnamneseInput,
} from "./anamnese.dto";
import * as repository from "./anamnese.repository";
import type { AnamneseProcedure, AnamneseRow } from "./anamnese.schema";

/**
 * Regras da anamnese.
 *
 * Três decisões moram aqui:
 *
 * 1. É dado de saúde. Só OWNER e PRO acessam — a recepção não vê nem gerencia,
 *    igual às observações de saúde da cliente. A checagem é uma porta única por
 *    onde toda operação passa.
 *
 * 2. Ficha assinada é imutável. Assinar transforma o rascunho num documento;
 *    depois disso, corrigir é criar uma ficha nova, não reescrever a antiga.
 *
 * 3. Histórico por cliente. Cada ficha nova preserva as anteriores. A "vigente"
 *    é simplesmente a mais recente.
 */

/** A porta única de acesso: anamnese é dado clínico, recepção não entra. */
function assertCanAccess(user: SessionUser): void {
  if (user.role !== "OWNER" && user.role !== "PRO") {
    throw new ForbiddenError("Seu perfil não tem acesso às fichas de anamnese.");
  }
}

async function requireClient(clientId: string) {
  const client = await findClientById(clientId);
  if (!client) throw new NotFoundError("Cliente");
  return client;
}

async function requireForm(id: string): Promise<AnamneseRow> {
  const row = await repository.findById(id);
  if (!row) throw new NotFoundError("Anamnese");
  return row;
}

export async function listByClient(
  clientId: string,
  user: SessionUser,
): Promise<AnamneseListItem[]> {
  assertCanAccess(user);
  await requireClient(clientId);
  const rows = await repository.listByClient(clientId);
  return rows.map(toAnamneseListItem);
}

export async function getById(
  id: string,
  user: SessionUser,
  options: { withSignatures?: boolean } = {},
): Promise<AnamneseDto> {
  assertCanAccess(user);
  const row = await requireForm(id);
  return toAnamneseDto(row, options);
}

/**
 * Cria uma ficha nova para a cliente. Se já houver um rascunho aberto, devolve
 * ele em vez de abrir outro — dois rascunhos vazios só confundiriam. Para
 * refazer uma ficha já assinada, criar uma nova é o caminho certo.
 */
export async function createForClient(
  clientId: string,
  procedure: AnamneseProcedure,
  user: SessionUser,
): Promise<AnamneseDto> {
  assertCanAccess(user);
  await requireClient(clientId);

  const openDraft = await repository.findOpenDraftByClient(clientId, procedure);
  if (openDraft) return toAnamneseDto(openDraft);

  const row = await repository.insert({ clientId, procedure, createdBy: user.id, answers: {} });
  return toAnamneseDto(row);
}

export async function saveDraft(
  id: string,
  input: SaveAnamneseInput,
  user: SessionUser,
): Promise<AnamneseDto> {
  assertCanAccess(user);
  const row = await requireForm(id);

  if (row.status === "SIGNED") {
    throw new BadRequestError(
      "Esta ficha já foi assinada e não pode ser alterada. Crie uma nova anamnese para atualizar.",
    );
  }

  const updated = await repository.updateDraft(id, {
    ...(input.answers !== undefined && { answers: input.answers }),
    ...(input.observations !== undefined && { observations: input.observations }),
  });
  // Corrida: alguém assinou entre a leitura e a escrita.
  if (!updated) throw new BadRequestError("Esta ficha foi assinada e não pode mais ser alterada.");

  return toAnamneseDto(updated);
}

/**
 * Assina a ficha. Congela a identidade de cliente e responsável técnica no
 * momento — para o documento não mudar se um cadastro for editado depois — e
 * grava as duas assinaturas. A partir daqui a ficha é imutável.
 */
export async function sign(
  id: string,
  input: SignAnamneseInput,
  user: SessionUser,
): Promise<AnamneseDto> {
  assertCanAccess(user);
  const row = await requireForm(id);

  if (row.status === "SIGNED") {
    throw new BadRequestError("Esta ficha já está assinada.");
  }

  const client = await requireClient(row.clientId);
  const snapshot = buildSignatureSnapshot(client);

  const updated = await repository.updateDraft(id, {
    status: "SIGNED",
    ...(input.answers !== undefined && { answers: input.answers }),
    ...(input.observations !== undefined && { observations: input.observations }),
    clientSignature: input.clientSignature,
    professionalSignature: input.professionalSignature,
    professionalId: input.professionalId ?? null,
    signedSnapshot: snapshot,
    signedAt: new Date(),
  });
  if (!updated) throw new BadRequestError("Esta ficha já está assinada.");

  return toAnamneseDto(updated, { withSignatures: true });
}

/** Descarta um rascunho. Ficha assinada não se apaga por aqui — é documento. */
export async function discardDraft(id: string, user: SessionUser): Promise<void> {
  assertCanAccess(user);
  const row = await requireForm(id);
  if (row.status === "SIGNED") {
    throw new BadRequestError("Uma ficha assinada não pode ser descartada.");
  }
  const removed = await repository.deleteDraft(id);
  if (!removed) throw new NotFoundError("Anamnese");
}
