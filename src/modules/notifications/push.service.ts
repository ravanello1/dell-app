import webpush from "web-push";
import { env } from "@/core/config/env";
import type { SessionUser } from "@/core/auth/session";
import type { UserRole } from "@/modules/auth/user.schema";
import * as repository from "./push.repository";
import type { PushPayload, PushSubscriptionInput } from "./push.dto";

/**
 * Envio de notificações push (Web Push).
 *
 * Só liga se as chaves VAPID estiverem no ambiente. Sem elas, todas as funções
 * viram no-op — o app inteiro funciona igual, só sem notificação. Isso deixa o
 * deploy subir antes de as chaves serem configuradas na Vercel.
 */

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = env.VAPID_PRIVATE_KEY;

let configured = false;
function ensureConfigured(): boolean {
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, publicKey, privateKey);
    configured = true;
  }
  return true;
}

/** As notificações estão disponíveis neste ambiente? */
export function isPushEnabled(): boolean {
  return Boolean(publicKey && privateKey);
}

export async function subscribe(user: SessionUser, input: PushSubscriptionInput): Promise<void> {
  await repository.upsertSubscription({
    userId: user.id,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: undefined,
  });
}

export async function unsubscribe(endpoint: string): Promise<void> {
  await repository.deleteByEndpoint(endpoint);
}

/** Envia uma notificação de teste para os próprios aparelhos do usuário, para
 *  ele conferir na hora se está chegando. */
export async function sendTest(user: SessionUser): Promise<{ sent: number }> {
  if (!ensureConfigured()) return { sent: 0 };

  const subscriptions = await repository.findByUser(user.id);
  const body = JSON.stringify({
    title: "Tudo certo! 🔔",
    body: "As notificações do Dell App estão funcionando neste aparelho.",
    url: "/",
    tag: "teste",
  } satisfies PushPayload);

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await repository.deleteByEndpoint(sub.endpoint).catch(() => {});
        }
      }
    }),
  );
  return { sent };
}

/**
 * Envia uma notificação para todos os aparelhos dos usuários com os papéis
 * dados. Uma inscrição vencida (404/410) é apagada na hora; uma falha isolada
 * nunca derruba as outras nem a operação que disparou o envio.
 */
export async function sendToRoles(
  roles: readonly UserRole[],
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  const subscriptions = await repository.findByRoles(roles);
  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 = o navegador descartou a inscrição. Limpa para não insistir.
        if (status === 404 || status === 410) {
          await repository.deleteByEndpoint(sub.endpoint).catch(() => {});
          removed += 1;
        } else {
          console.error("[push] falha ao enviar:", status ?? error);
        }
      }
    }),
  );

  return { sent, removed };
}
