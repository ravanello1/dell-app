import { NotFoundError } from "@/core/api/errors";
import type { SessionUser } from "@/core/auth/session";
import { formatInStudio } from "@/core/utils/date";
import { listActiveForMarketing } from "@/modules/clients/client.repository";
import { getLastVisitByClient } from "@/modules/agenda/agenda.service";
import {
  marketingClient,
  toPromotionDto,
  type CreatePromotionInput,
  type MarketingClient,
  type MarketingData,
  type PromotionDto,
  type UpdatePromotionInput,
} from "./marketing.dto";
import * as repository from "./promotion.repository";

/**
 * Regras do marketing.
 *
 * Costura clientes e agenda pela porta da frente (repositório de clientes e
 * service da agenda), como o painel "Hoje" faz — nenhum módulo passa a conhecer
 * o outro. Não envia nada: só prepara os grupos e as promoções; o envio é um
 * link de WhatsApp aberto na tela, uma cliente por vez.
 *
 * O grupo "sumidas" é derivado no cliente a partir de `all` (que traz última
 * visita e cadastro de cada uma), para o seletor de dias responder na hora, sem
 * recarregar a página.
 */
export async function getMarketingData(): Promise<MarketingData> {
  const [clients, lastVisits, promotions] = await Promise.all([
    listActiveForMarketing(),
    getLastVisitByClient(),
    repository.listPromotions(),
  ]);

  const now = new Date();
  const currentMonth = formatInStudio(now, "MM");
  const todayDay = Number(formatInStudio(now, "dd"));

  const birthdays: MarketingClient[] = [];
  const all: MarketingClient[] = [];

  for (const client of clients) {
    const lastVisit = lastVisits.get(client.id) ?? null;
    all.push(marketingClient(client, { lastVisitAt: lastVisit }));

    if (client.birthDate && client.birthDate.slice(5, 7) === currentMonth) {
      const day = Number(client.birthDate.slice(8, 10));
      birthdays.push(
        marketingClient(client, { birthdayDay: day, isBirthdayToday: day === todayDay }),
      );
    }
  }

  birthdays.sort((a, b) => (a.birthdayDay ?? 0) - (b.birthdayDay ?? 0));

  return { birthdays, all, promotions: promotions.map(toPromotionDto), nowMs: now.getTime() };
}

// ── Promoções ─────────────────────────────────────────────────────────────────

export async function listPromotions(): Promise<PromotionDto[]> {
  const rows = await repository.listPromotions();
  return rows.map(toPromotionDto);
}

export async function createPromotion(
  input: CreatePromotionInput,
  user: SessionUser,
): Promise<PromotionDto> {
  const row = await repository.insert({
    title: input.title,
    message: input.message,
    active: input.active,
    createdBy: user.id,
  });
  return toPromotionDto(row);
}

export async function updatePromotion(
  id: string,
  input: UpdatePromotionInput,
): Promise<PromotionDto> {
  const row = await repository.update(id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.message !== undefined && { message: input.message }),
    ...(input.active !== undefined && { active: input.active }),
  });
  if (!row) throw new NotFoundError("Promoção");
  return toPromotionDto(row);
}

export async function deletePromotion(id: string): Promise<void> {
  const removed = await repository.remove(id);
  if (!removed) throw new NotFoundError("Promoção");
}
