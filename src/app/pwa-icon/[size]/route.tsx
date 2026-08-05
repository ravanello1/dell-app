import { ImageResponse } from "next/og";

/**
 * Ícones do PWA gerados no servidor, em PNG.
 *
 * Desenhados só com traços vetoriais — nenhum texto — de propósito: o gerador
 * de imagem precisaria de um arquivo de fonte embarcado para renderizar letras,
 * e o desenho dispensa isso.
 *
 * O recorte do ícone "maskable" no Android corta um círculo de ~80% do quadro,
 * então o leque fica dentro de uma área segura central.
 */

const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const { size: rawSize } = await context.params;
  const size = Number(rawSize);

  if (!ALLOWED_SIZES.has(size)) {
    return new Response("Tamanho de ícone não suportado.", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #d5b449 0%, #c9a227 45%, #a9861c 100%)",
        }}
      >
        <svg width="62%" height="62%" viewBox="0 0 512 512" fill="none">
          <g
            stroke="#ffffff"
            strokeWidth="26"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M118 300 Q256 372 394 300" />
            <path d="M150 316 Q158 246 176 206" />
            <path d="M204 340 Q212 250 236 190" />
            <path d="M262 348 Q268 240 288 176" />
            <path d="M320 338 Q332 246 356 192" />
            <path d="M370 312 Q384 250 406 214" />
          </g>
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
