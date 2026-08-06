import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ensureSession } from "@/core/auth/guard";
import { PageHeader } from "@/ui/card";
import { getMarketingData } from "@/modules/marketing/marketing.service";
import { MarketingView } from "@/modules/marketing/components/marketing-view";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingPage() {
  await ensureSession();
  const data = await getMarketingData();

  return (
    <>
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-gold-700"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Clientes
      </Link>

      <PageHeader
        title="Marketing"
        description="Mensagens prontas e promoções, enviadas por WhatsApp"
      />

      <MarketingView data={data} />
    </>
  );
}
