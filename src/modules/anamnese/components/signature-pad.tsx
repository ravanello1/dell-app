"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Eraser } from "lucide-react";

/**
 * Prancheta de assinatura desenhada com o dedo (ou mouse).
 *
 * Detalhes que fazem funcionar de verdade no celular:
 *  · Pointer Events unificam toque e mouse num só caminho.
 *  · `touch-action: none` impede a página de rolar enquanto a pessoa assina.
 *  · O canvas é escalado pelo devicePixelRatio, senão o traço sai borrado em
 *    tela retina.
 *  · O traço é guardado como caminho e redesenhado ao redimensionar, para a
 *    assinatura não sumir se o teclado virtual abrir e mudar o tamanho.
 */

export interface SignaturePadHandle {
  /** PNG em data URI, ou null se nada foi desenhado. */
  toDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

type Point = { x: number; y: number };
type Stroke = Point[];

export function SignaturePad({
  ref,
  label,
  onChangeEmpty,
}: {
  ref?: Ref<SignaturePadHandle>;
  label: string;
  /** Avisa a tela quando passa de vazio para preenchido (e vice-versa). */
  onChangeEmpty?: (empty: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  const setEmptyState = useCallback(
    (value: boolean) => {
      setEmpty(value);
      onChangeEmpty?.(value);
    },
    [onChangeEmpty],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#241C1A";

    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      const first = stroke[0]!;
      ctx.moveTo(first.x, first.y);
      if (stroke.length === 1) {
        // Um toque só: um ponto visível.
        ctx.lineTo(first.x + 0.1, first.y + 0.1);
      } else {
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
      }
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  useImperativeHandle(
    ref,
    () => ({
      toDataURL: () => {
        const canvas = canvasRef.current;
        if (!canvas || strokesRef.current.length === 0) return null;
        return canvas.toDataURL("image/png");
      },
      clear: () => {
        strokesRef.current = [];
        redraw();
        setEmptyState(true);
      },
      isEmpty: () => strokesRef.current.length === 0,
    }),
    [redraw, setEmptyState],
  );

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handleDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokesRef.current.push([pointFrom(event)]);
    if (empty) setEmptyState(false);
    redraw();
  }

  function handleMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    strokesRef.current.at(-1)?.push(pointFrom(event));
    redraw();
  }

  function handleUp() {
    drawingRef.current = false;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-700">{label}</span>
        <button
          type="button"
          onClick={() => {
            strokesRef.current = [];
            redraw();
            setEmptyState(true);
          }}
          className="inline-flex items-center gap-1 text-xs text-ink-500 transition-colors hover:text-danger"
        >
          <Eraser className="size-3.5" aria-hidden />
          Limpar
        </button>
      </div>

      <div className="relative overflow-hidden rounded-(--radius-field) border border-line-strong bg-surface">
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          onPointerCancel={handleUp}
          className="h-40 w-full cursor-crosshair touch-none"
          aria-label={label}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs text-ink-300">
            assine no espaço acima
          </span>
        )}
        {/* Linha de base, como numa ficha de papel. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-5 border-b border-dashed border-line-strong"
        />
      </div>
    </div>
  );
}
