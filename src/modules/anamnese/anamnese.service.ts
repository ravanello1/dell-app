import { BadRequestError, ForbiddenError, NotFoundError } from "@/core/api/errors";
import type { SessionUser } from "@/core/auth/session";
import { findClientById } from "@/modules/clients/client.repository";
import {
  buildSignatureSnapshot,
  toAnamneseDto,
  toAnamneseListItem,
  toPublicAnamneseDto,
  type AnamneseDto,
  type AnamneseListItem,
  type PublicAnamneseDto,
  type PublicAnamneseState,
  type SaveAnamneseInput,
  type SignAnamneseInput,
  type SubmitPublicInput,
} from "./anamnese.dto";
import * as repository from "./anamnese.repository";
import { generateAnamneseToken, hashAnamneseToken, PUBLIC_LINK_TTL_MS } from "./anamnese.token";
import { procedureLabels } from "./anamnese.questions";
import { sendToRoles } from "@/modules/notifications/push.service";
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

  // A assinatura da cliente vem da tela (fluxo presencial) ou já está guardada,
  // do preenchimento remoto. Uma das duas precisa existir — nunca vira documento
  // sem a assinatura da cliente.
  const clientSignature = input.clientSignature ?? row.clientSignature;
  if (!clientSignature) {
    throw new BadRequestError("Falta a assinatura da cliente.");
  }

  const client = await requireClient(row.clientId);
  const snapshot = buildSignatureSnapshot(client);

  const updated = await repository.updateDraft(id, {
    status: "SIGNED",
    ...(input.answers !== undefined && { answers: input.answers }),
    ...(input.observations !== undefined && { observations: input.observations }),
    clientSignature,
    professionalSignature: input.professionalSignature,
    professionalId: input.professionalId ?? null,
    signedSnapshot: snapshot,
    signedAt: new Date(),
    // O link não serve mais depois de assinada.
    publicTokenHash: null,
    publicTokenExpiresAt: null,
  });
  if (!updated) throw new BadRequestError("Esta ficha já está assinada.");

  return toAnamneseDto(updated, { withSignatures: true });
}

// ── Link público (preenchimento remoto pela cliente) ─────────────────────────

/**
 * Gera (ou renova) o link público de uma ficha em rascunho e devolve o token
 * cru — que só existe aqui e na URL enviada à cliente. No banco fica só o hash.
 * Recriar o link invalida o anterior, porque troca o hash guardado.
 */
export async function createPublicLink(
  id: string,
  user: SessionUser,
): Promise<{ token: string; client: { name: string; phone: string } }> {
  assertCanAccess(user);
  const row = await requireForm(id);

  if (row.status === "SIGNED") {
    throw new BadRequestError("Esta ficha já está assinada — não há o que preencher.");
  }

  const client = await requireClient(row.clientId);
  const { token, hash } = generateAnamneseToken();

  const updated = await repository.updateDraft(id, {
    publicTokenHash: hash,
    publicTokenExpiresAt: new Date(Date.now() + PUBLIC_LINK_TTL_MS),
  });
  if (!updated) throw new BadRequestError("Esta ficha já está assinada.");

  return { token, client: { name: client.name, phone: client.phone } };
}

/**
 * Lê a ficha a partir do token do link, para a página pública. Não exige sessão:
 * o token é a credencial, e dá acesso a esta ficha e só a ela.
 */
export async function getPublicByToken(token: string): Promise<PublicAnamneseDto> {
  const row = await repository.findByTokenHash(hashAnamneseToken(token));
  if (!row) throw new NotFoundError("Link");

  const client = await requireClient(row.clientId);
  const firstName = client.name.trim().split(/\s+/)[0] ?? client.name;

  const expired =
    !row.publicTokenExpiresAt || row.publicTokenExpiresAt.getTime() < Date.now();

  let state: PublicAnamneseState;
  if (row.status === "SIGNED") state = "SIGNED";
  else if (row.clientSubmittedAt) state = "SUBMITTED";
  else if (expired) state = "EXPIRED";
  else state = "FILLABLE";

  return toPublicAnamneseDto(row, state, firstName);
}

/**
 * Recebe o preenchimento e a assinatura da cliente pelo link. Guarda tudo no
 * rascunho e marca `clientSubmittedAt`; a ficha só vira documento quando a
 * profissional contra-assina no studio. Recusa link expirado, já enviado ou já
 * assinado — de propósito, para o link não ser reusado para alterar depois.
 */
export async function submitPublicByToken(
  token: string,
  input: SubmitPublicInput,
): Promise<{ clientFirstName: string }> {
  const row = await repository.findByTokenHash(hashAnamneseToken(token));
  if (!row) throw new NotFoundError("Link");

  if (row.status === "SIGNED") {
    throw new BadRequestError("Esta ficha já foi finalizada.");
  }
  if (row.clientSubmittedAt) {
    throw new BadRequestError("Esta ficha já foi enviada. Obrigada!");
  }
  if (!row.publicTokenExpiresAt || row.publicTokenExpiresAt.getTime() < Date.now()) {
    throw new BadRequestError("Este link expirou. Peça um novo ao studio.");
  }

  const updated = await repository.updateDraft(row.id, {
    answers: input.answers,
    observations: input.observations ?? row.observations,
    clientSignature: input.clientSignature,
    clientSubmittedAt: new Date(),
  });
  if (!updated) throw new BadRequestError("Esta ficha já foi finalizada.");

  const client = await requireClient(row.clientId);
  const firstName = client.name.trim().split(/\s+/)[0] ?? client.name;

  // Avisa a profissional no celular. Nunca deixa uma falha de push derrubar o
  // envio da cliente — o que importa é a ficha ter sido salva.
  try {
    await sendToRoles(["OWNER", "PRO"], {
      title: "Anamnese recebida ✍️",
      body: `${firstName} devolveu a ficha de ${procedureLabels[row.procedure]} assinada. Confira e contra-assine.`,
      url: `/clientes/${row.clientId}/anamnese/${row.id}`,
      tag: `anamnese-${row.id}`,
    });
  } catch (error) {
    console.error("[anamnese] falha ao notificar envio:", error);
  }

  return { clientFirstName: firstName };
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
