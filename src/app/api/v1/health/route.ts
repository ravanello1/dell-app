import { NextResponse } from "next/server";
import { checkDatabase } from "@/core/health";

/**
 * Verificação de saúde — a rota que se abre logo depois de um deploy para
 * saber se a aplicação subiu e se ela realmente alcança o banco.
 * É a única rota da API que responde sem sessão.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { latencyMs } = await checkDatabase();
    return NextResponse.json({
      data: {
        status: "ok",
        database: "conectado",
        latencyMs,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[health] banco inacessível:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Aplicação no ar, mas sem conexão com o banco de dados.",
        },
      },
      { status: 503 },
    );
  }
}
