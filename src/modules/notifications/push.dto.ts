import { z } from "zod";

/**
 * Formato da inscrição que o navegador entrega ao assinar o push. É o
 * `PushSubscription.toJSON()` do padrão Web Push — endpoint + as duas chaves.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url("Endpoint de push inválido."),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** Conteúdo de uma notificação — o que o service worker vai exibir. */
export interface PushPayload {
  title: string;
  body: string;
  /** Para onde levar ao tocar na notificação (rota interna do app). */
  url: string;
  tag?: string;
}
