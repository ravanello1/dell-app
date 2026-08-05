import { ImageResponse } from "next/og";

/** Ícone que o iPhone usa ao adicionar o app à tela de início. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <svg width="66%" height="66%" viewBox="0 0 512 512" fill="none">
          <g
            stroke="#ffffff"
            strokeWidth="28"
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
    size,
  );
}
