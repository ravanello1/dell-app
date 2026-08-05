import type { Metadata } from "next";
import { ensureSession } from "@/core/auth/guard";
import { PageHeader } from "@/ui/card";
import { InventoryView } from "@/modules/inventory/components/inventory-view";

export const metadata: Metadata = { title: "Estoque" };

export default async function InventoryPage() {
  const session = await ensureSession();

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Saldo, reposição e o histórico de cada produto"
      />
      <InventoryView canSeeCosts={session.role === "OWNER"} />
    </>
  );
}
