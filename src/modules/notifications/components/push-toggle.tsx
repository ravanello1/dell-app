"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, BellRing, Smartphone } from "lucide-react";
import { api } from "@/core/api/client";
import { Button } from "@/ui/button";
import { Card, CardBody, CardHeader } from "@/ui/card";

/**
 * Liga/desliga as notificações push neste aparelho.
 *
 * O caminho tem várias portas que podem estar fechadas — navegador sem suporte,
 * iPhone fora do app instalado, permissão negada, chaves não configuradas —, e
 * cada uma dá uma mensagem própria, porque "não funcionou" sem dizer o motivo é
 * o pior dos mundos para quem está de celular na mão.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "unconfigured"
  | "denied"
  | "off"
  | "on";

/** Converte a chave pública VAPID (base64url) no formato que o navegador exige.
 *  Ancorado num ArrayBuffer explícito para o tipo casar com `applicationServerKey`. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function detect() {
      if (!VAPID_PUBLIC_KEY) return setState("unconfigured");

      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        // No iPhone, o suporte só existe dentro do app instalado.
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        return setState(iOS && !isStandalone() ? "needs-install" : "unsupported");
      }

      if (Notification.permission === "denied") return setState("denied");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    }
    void detect();
  }, []);

  async function enable() {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        toast.error("Permissão de notificação não concedida.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await api.post("/push/subscribe", sub.toJSON());
      setState("on");
      toast.success("Notificações ativadas neste aparelho.");
    } catch (error) {
      console.error("[push] falha ao ativar:", error);
      toast.error("Não foi possível ativar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTestNotification() {
    setBusy(true);
    try {
      const result = await api.post<{ sent: number }>("/push/test", {});
      if (result.sent > 0) toast.success("Teste enviado. Deve chegar em instantes.");
      else toast.error("Nenhum aparelho recebeu. Reative as notificações e tente de novo.");
    } catch {
      toast.error("Não foi possível enviar o teste.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Notificações desativadas neste aparelho.");
    } catch {
      toast.error("Não foi possível desativar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Notificações no celular"
        description="Avisa quando uma cliente devolve a anamnese preenchida pelo link."
      />
      <CardBody>{renderBody()}</CardBody>
    </Card>
  );

  function renderBody() {
    switch (state) {
      case "loading":
        return <p className="text-sm text-ink-400">Verificando…</p>;

      case "unconfigured":
        return (
          <Notice icon={<BellOff />} tone="muted">
            As notificações ainda não foram configuradas no servidor. (Faltam as chaves VAPID no
            ambiente.)
          </Notice>
        );

      case "unsupported":
        return (
          <Notice icon={<BellOff />} tone="muted">
            Este navegador não suporta notificações. Tente pelo Chrome (Android) ou pelo app
            instalado.
          </Notice>
        );

      case "needs-install":
        return (
          <Notice icon={<Smartphone />} tone="gold">
            No iPhone, as notificações só funcionam com o app instalado. Toque em compartilhar no
            Safari → <strong>Adicionar à Tela de Início</strong>, abra por lá e volte aqui.
          </Notice>
        );

      case "denied":
        return (
          <Notice icon={<BellOff />} tone="warning">
            As notificações estão bloqueadas nas configurações do aparelho para este app. Libere-as
            e recarregue esta página.
          </Notice>
        );

      case "on":
        return (
          <div className="flex flex-col gap-3">
            <Notice icon={<BellRing />} tone="success">
              Ativadas neste aparelho. Você vai receber um aviso quando uma cliente devolver a
              ficha.
            </Notice>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={sendTestNotification} loading={busy}>
                <BellRing className="size-4" aria-hidden />
                Enviar teste
              </Button>
              <Button variant="ghost" size="sm" onClick={disable} loading={busy}>
                <BellOff className="size-4" aria-hidden />
                Desativar aqui
              </Button>
            </div>
          </div>
        );

      case "off":
      default:
        return (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-600">
              Ative para receber um aviso na hora em que a ficha chegar, mesmo com o app fechado.
            </p>
            <div>
              <Button size="sm" onClick={enable} loading={busy}>
                <Bell className="size-4" aria-hidden />
                Ativar notificações
              </Button>
            </div>
          </div>
        );
    }
  }
}

function Notice({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: "muted" | "gold" | "warning" | "success";
  children: React.ReactNode;
}) {
  const tones = {
    muted: "border-line bg-surface-muted text-ink-600",
    gold: "border-gold-200 bg-gold-50 text-ink-700",
    warning: "border-warning/25 bg-warning-soft text-ink-700",
    success: "border-success/25 bg-success-soft text-ink-700",
  } as const;
  return (
    <div className={`flex items-start gap-2.5 rounded-(--radius-field) border p-3 ${tones[tone]}`}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-[18px]" aria-hidden>
        {icon}
      </span>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}
