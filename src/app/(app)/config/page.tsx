import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureSession } from "@/core/auth/guard";
import { PageHeader } from "@/ui/card";
import { SettingsView } from "@/modules/agenda/components/settings-view";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const session = await ensureSession();

  // Procedimentos e preços são decisão de dona do negócio.
  if (session.role !== "OWNER") redirect("/");

  return (
    <>
      <PageHeader title="Ajustes" description="Procedimentos e profissionais do studio" />
      <SettingsView />
    </>
  );
}
