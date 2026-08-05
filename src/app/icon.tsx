import { ImageResponse } from "next/og";

/** Favicon da aba do navegador. Em 32px o leque some, então fica só o traço
 *  essencial: a curva da pálpebra com três fios. */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #d5b449 0%, #a9861c 100%)",
          borderRadius: 6,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 512 512" fill="none">
          <g
            stroke="#ffffff"
            strokeWidth="46"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M110 302 Q256 380 402 302" />
            <path d="M196 344 Q206 250 234 188" />
            <path d="M300 342 Q314 248 342 190" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
