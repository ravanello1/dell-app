import "./env";
import { deflateSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { clients } from "@/modules/clients/client.schema";
import { users } from "@/modules/auth/user.schema";
import { anamneseForms } from "@/modules/anamnese/anamnese.schema";
import * as service from "@/modules/anamnese/anamnese.service";
import type { SessionUser } from "@/core/auth/session";

/**
 * Semente de desenvolvimento: cria uma ficha rascunho e uma assinada para a
 * primeira cliente, com assinaturas PNG visíveis, só para conferir o render no
 * navegador. Não vai para produção.
 */

/** Gera um PNG simples (fundo branco + traços pretos) como data URI — uma
 *  "assinatura" visível, sem depender de biblioteca. */
function fakeSignaturePng(seed: number): string {
  const w = 260;
  const h = 80;
  const px = Buffer.alloc(w * h * 4, 0);
  // fundo branco
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = 255;
    px[i * 4 + 1] = 255;
    px[i * 4 + 2] = 255;
    px[i * 4 + 3] = 255;
  }
  const ink = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const o = (y * w + x) * 4;
    px[o] = 36;
    px[o + 1] = 28;
    px[o + 2] = 26;
    px[o + 3] = 255;
  };
  // uma curva senoidal com uma "cauda", variada pelo seed
  for (let x = 20; x < w - 20; x++) {
    const y =
      h / 2 +
      Math.sin((x + seed * 30) / 13) * 16 +
      Math.sin((x + seed) / 5) * 4;
    for (let t = -1; t <= 1; t++) ink(x, Math.round(y) + t);
  }
  return "data:image/png;base64," + encodePng(px, w, h);
}

function encodePng(rgba: Buffer, w: number, h: number): string {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk("IHDR", (() => {
    const b = Buffer.alloc(13);
    b.writeUInt32BE(w, 0);
    b.writeUInt32BE(h, 4);
    b[8] = 8; // bit depth
    b[9] = 6; // RGBA
    return b;
  })());
  // scanlines com byte de filtro 0
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]).toString("base64");
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

async function main() {
  const [client] = await db.select().from(clients).limit(1);
  if (!client) throw new Error("Sem clientes no banco. Rode o seed primeiro.");

  const [ownerRow] = await db.select().from(users).where(eq(users.role, "OWNER")).limit(1);
  if (!ownerRow) throw new Error("Sem usuária OWNER no banco. Rode o seed primeiro.");

  const owner: SessionUser = {
    id: ownerRow.id,
    name: ownerRow.name,
    email: ownerRow.email,
    role: "OWNER",
  };

  // Limpa fichas anteriores desta cliente para o teste ficar previsível.
  await db.delete(anamneseForms).where(eq(anamneseForms.clientId, client.id));

  // 1) Uma ficha de extensão de cílios, assinada, com alguns "sim".
  const draft1 = await service.createForClient(client.id, "CILIOS", owner);
  const signed = await service.sign(
    draft1.id,
    {
      answers: {
        gestante: { value: false, detail: "" },
        cil_alergia_cianoacrilato: {
          value: true,
          detail: "Vermelhidão leve há 2 anos, com outra profissional.",
        },
        cil_lentes_contato: { value: true, detail: "" },
        cil_olhos_lacrimejam: { value: true, detail: "" },
        cil_extensao_anterior: { value: true, detail: "Volume russo, há 3 meses." },
      },
      observations: "Cliente prefere volume mais leve. Retirar com cuidado por causa da sensibilidade.",
      clientSignature: fakeSignaturePng(1),
      professionalSignature: fakeSignaturePng(7),
    },
    owner,
  );

  // 2) Rascunhos abertos de henna e lash lifting, para ver os formulários.
  const draftHenna = await service.createForClient(client.id, "HENNA", owner);
  const draftLifting = await service.createForClient(client.id, "LASH_LIFTING", owner);

  console.log("cliente:  ", client.id, "—", client.name);
  console.log("assinada (cílios): /clientes/" + client.id + "/anamnese/" + signed.id);
  console.log("rascunho (henna):  /clientes/" + client.id + "/anamnese/" + draftHenna.id);
  console.log("rascunho (lift):   /clientes/" + client.id + "/anamnese/" + draftLifting.id);
  console.log("lista:             /clientes/" + client.id + "/anamnese");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
