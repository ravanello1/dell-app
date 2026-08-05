import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureSession } from "@/core/auth/guard";
import { PageHeader } from "@/ui/card";
import { SettingsView } from "@/modules/agenda/components/settings-view";
import { PushToggle } from "@/modules/notifications/components/push-toggle";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const session = await ensureSession();

  // Procedimentos e preços são decisão de dona do negócio.
  if (session.role !== "OWNER") redirect("/");

  return (
    <>
      <PageHeader title="Ajustes" description="Procedimentos, profissionais e notificações" />
      <div className="flex flex-col gap-6">
        <PushToggle />
        <SettingsView />
      </div>
    </>
  );
}
