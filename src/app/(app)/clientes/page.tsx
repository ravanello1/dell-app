import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/ui/button";
import { PageHeader } from "@/ui/card";
import { ClientList } from "@/modules/clients/components/client-list";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clientes"
        description="Toda a base do studio, com busca por nome ou telefone"
        action={
          <Button asChild>
            <Link href="/clientes/nova">
              <UserPlus className="size-4" aria-hidden />
              Nova cliente
            </Link>
          </Button>
        }
      />
      <ClientList />
    </>
  );
}
