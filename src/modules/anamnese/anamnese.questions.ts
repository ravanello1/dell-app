import type { AnamneseProcedure } from "./anamnese.schema";

/**
 * Catálogo das perguntas da anamnese, por procedimento.
 *
 * As perguntas moram no código, não no banco: são poucas, mudam raramente e
 * precisam de rótulo, agrupamento e a lógica de "se sim, detalhe qual". A ficha
 * guarda só as respostas, referenciando cada pergunta pelo `id`, e sabe a qual
 * procedimento pertence — então o formulário e a impressão montam o conjunto
 * certo de perguntas por tipo.
 *
 * Cada ficha tem os GRUPOS PADRÃO (gestante, alergias, saúde) mais os grupos
 * ESPECÍFICOS do procedimento. O conteúdo específico vem de pesquisa de
 * contraindicações e risco de alergia de cada técnica:
 *  · Lash lifting e brow lamination usam agente redutor (tioglicolato de amônia,
 *    cisteamina) — a mesma química da permanente capilar, com reação cruzada.
 *  · Henna carrega o risco de PPD (parafenilenodiamina) e da reação cruzada com
 *    tintura de cabelo, o sensibilizante mais grave dos três.
 *
 * REGRA DE OURO: nunca reaproveite um `id` para outra pergunta — isso
 * reinterpretaria respostas de fichas já assinadas. Aposente o id e crie um novo.
 */

export interface AnamneseQuestion {
  id: string;
  label: string;
  /** Quando respondida "sim", abre um campo para detalhar. */
  wantsDetail: boolean;
  detailLabel?: string;
  /** Marca perguntas cujo "sim" é sinal de risco alto (destaque na ficha). */
  critical?: boolean;
}

export interface AnamneseGroup {
  id: string;
  title: string;
  questions: AnamneseQuestion[];
}

// ── Metadados dos procedimentos ───────────────────────────────────────────────

export const procedureLabels: Record<AnamneseProcedure, string> = {
  CILIOS: "Extensão de cílios",
  LASH_LIFTING: "Lash lifting",
  BROW_LAMINATION: "Brow lamination",
  HENNA: "Henna de sobrancelha",
};

export const procedureDescriptions: Record<AnamneseProcedure, string> = {
  CILIOS: "Fios aplicados fio a fio nos cílios",
  LASH_LIFTING: "Curvatura permanente dos cílios naturais",
  BROW_LAMINATION: "Alinhamento e fixação dos fios da sobrancelha",
  HENNA: "Coloração de pelos e pele da sobrancelha",
};

// ── Grupos padrão (todos os procedimentos) ────────────────────────────────────

const SHARED_GROUPS: AnamneseGroup[] = [
  {
    id: "gestacao",
    title: "Gestação e amamentação",
    questions: [
      {
        id: "gestante",
        label: "Está grávida ou com suspeita de gravidez?",
        wantsDetail: true,
        detailLabel: "De quantas semanas?",
      },
      { id: "lactante", label: "Está amamentando?", wantsDetail: false },
    ],
  },
  {
    id: "alergias_gerais",
    title: "Alergias e sensibilidade",
    questions: [
      {
        id: "alergia_cosmeticos",
        label: "Já teve reação alérgica a algum cosmético, maquiagem, esmalte ou cola?",
        wantsDetail: true,
        detailLabel: "A qual produto e que reação?",
        critical: true,
      },
      {
        id: "pele_sensivel",
        label: "Tem pele ou olhos sensíveis, que irritam com facilidade?",
        wantsDetail: true,
        detailLabel: "O que costuma irritar?",
      },
    ],
  },
  {
    id: "medicamentos",
    title: "Medicamentos",
    questions: [
      {
        id: "isotretinoina",
        label: "Usou isotretinoína (Roacutan) ou outro retinoide nos últimos 12 meses?",
        wantsDetail: true,
        detailLabel: "Qual e quando parou?",
        critical: true,
      },
      {
        id: "medicacao_continua",
        label: "Faz uso de alguma medicação contínua?",
        wantsDetail: true,
        detailLabel: "Quais medicamentos?",
      },
    ],
  },
  {
    id: "saude_geral",
    title: "Saúde geral",
    questions: [
      {
        id: "doenca_autoimune",
        label: "Tem doença autoimune (lúpus, vitiligo, alopecia) ou problema de tireoide?",
        wantsDetail: true,
        detailLabel: "Qual condição?",
      },
      { id: "diabetes", label: "Tem diabetes?", wantsDetail: true, detailLabel: "Controlada? Usa insulina?" },
    ],
  },
  {
    id: "pele_cicatrizacao",
    title: "Pele e cicatrização",
    questions: [
      {
        id: "queloide",
        label: "Tem tendência a quelóide ou dificuldade de cicatrização?",
        wantsDetail: false,
      },
      {
        id: "herpes_lesao",
        label: "Está com herpes ou alguma ferida/lesão ativa na região a ser tratada?",
        wantsDetail: true,
        detailLabel: "Descreva",
        critical: true,
      },
    ],
  },
  {
    id: "recente_historico",
    title: "Recentes e histórico",
    questions: [
      {
        id: "exposicao_solar",
        label: "Se bronzeou ou teve queimadura de sol na área nos últimos dias?",
        wantsDetail: false,
      },
      {
        id: "reacao_anterior",
        label: "Já fez este procedimento antes e teve alguma reação?",
        wantsDetail: true,
        detailLabel: "O que aconteceu e quando?",
        critical: true,
      },
    ],
  },
];

// ── Grupos específicos por procedimento ───────────────────────────────────────

const SPECIFIC_GROUPS: Record<AnamneseProcedure, AnamneseGroup[]> = {
  CILIOS: [
    {
      id: "cilios_olhos",
      title: "Olhos",
      questions: [
        { id: "cil_lentes_contato", label: "Usa lentes de contato?", wantsDetail: false },
        {
          id: "cil_problema_ocular",
          label: "Tem ou teve conjuntivite, glaucoma, blefarite ou terçol?",
          wantsDetail: true,
          detailLabel: "Qual e há quanto tempo?",
        },
        {
          id: "cil_cirurgia_ocular",
          label: "Fez cirurgia nos olhos nos últimos 6 meses?",
          wantsDetail: true,
          detailLabel: "Qual e quando?",
        },
        {
          id: "cil_olhos_lacrimejam",
          label: "Seus olhos lacrimejam muito, são secos ou ardem com facilidade?",
          wantsDetail: false,
        },
      ],
    },
    {
      id: "cilios_cola",
      title: "Cílios e cola",
      questions: [
        {
          id: "cil_alergia_cianoacrilato",
          label: "Já teve reação à cola de cílios (cianoacrilato) ou a esparadrapo/adesivo?",
          wantsDetail: true,
          detailLabel: "Que reação teve?",
          critical: true,
        },
        {
          id: "cil_queda_cilios",
          label: "Tem queda de cílios ou hábito de puxá-los?",
          wantsDetail: false,
        },
        {
          id: "cil_extensao_anterior",
          label: "Já usou extensão de cílios antes?",
          wantsDetail: true,
          detailLabel: "Qual técnica e há quanto tempo?",
        },
      ],
    },
  ],

  LASH_LIFTING: [
    {
      id: "ll_olhos",
      title: "Saúde dos olhos",
      questions: [
        {
          id: "ll_infeccao_ocular",
          label: "Está com conjuntivite, terçol ou blefarite agora?",
          wantsDetail: true,
          detailLabel: "Qual e há quanto tempo?",
          critical: true,
        },
        {
          id: "ll_olho_seco_sensivel",
          label: "Tem olho seco, muito sensível ou que lacrimeja/arde com facilidade?",
          wantsDetail: true,
          detailLabel: "Descreva",
        },
        {
          id: "ll_glaucoma",
          label: "Tem glaucoma?",
          wantsDetail: true,
          detailLabel: "Faz tratamento? Usa colírio?",
        },
        { id: "ll_lentes_contato", label: "Usa lentes de contato?", wantsDetail: false },
        {
          id: "ll_cirurgia_ocular",
          label: "Fez cirurgia nos olhos nos últimos 6 meses (LASIK, catarata, pálpebra)?",
          wantsDetail: true,
          detailLabel: "Qual e quando?",
          critical: true,
        },
      ],
    },
    {
      id: "ll_quimica",
      title: "Química e alergias",
      questions: [
        {
          id: "ll_alergia_permanente",
          label: "Tem alergia a permanente/alisamento de cabelo ou já reagiu a esses produtos?",
          wantsDetail: true,
          detailLabel: "Que reação teve?",
          critical: true,
        },
        {
          id: "ll_alergia_adesivo_silicone",
          label: "Já teve alergia a cola de cílios, cianoacrilato, esparadrapo, látex ou silicone?",
          wantsDetail: true,
          detailLabel: "A qual e que reação?",
          critical: true,
        },
        {
          id: "ll_colirio_crescimento",
          label: "Usa colírio para glaucoma ou sérum de crescimento de cílios (bimatoprosta/Latisse)?",
          wantsDetail: true,
          detailLabel: "Qual produto?",
        },
      ],
    },
    {
      id: "ll_cilios",
      title: "Cílios",
      questions: [
        {
          id: "ll_cilios_fracos",
          label: "Seus cílios são frágeis, finos ou quebradiços?",
          wantsDetail: false,
        },
        {
          id: "ll_lifting_recente",
          label: "Fez lash lifting, permanente ou tintura de cílios nos últimos 30 dias?",
          wantsDetail: true,
          detailLabel: "Qual e quando?",
        },
        {
          id: "ll_queda_cilios",
          label: "Tem queda de cílios (madarose) ou hábito de arrancá-los?",
          wantsDetail: false,
        },
      ],
    },
    {
      id: "ll_teste",
      title: "Teste de sensibilidade",
      questions: [
        {
          id: "ll_patch_test",
          label: "Fez o teste de toque 48h antes deste atendimento?",
          wantsDetail: true,
          detailLabel: "Houve alguma reação?",
        },
      ],
    },
  ],

  BROW_LAMINATION: [
    {
      id: "bl_quimica",
      title: "Química e alergias",
      questions: [
        {
          id: "bl_alergia_permanente",
          label: "Tem alergia a permanente/alisamento de cabelo ou já reagiu (coceira, feridas no couro)?",
          wantsDetail: true,
          detailLabel: "Que reação teve?",
          critical: true,
        },
        {
          id: "bl_lamination_anterior",
          label: "Já fez brow lamination ou lash lifting e teve alguma reação?",
          wantsDetail: true,
          detailLabel: "Descreva a reação",
          critical: true,
        },
        {
          id: "bl_alergia_adesivo",
          label: "Tem alergia a esparadrapo/fita, cola de cílios ou látex?",
          wantsDetail: true,
          detailLabel: "A quê e que reação?",
        },
      ],
    },
    {
      id: "bl_tintura",
      title: "Tintura e henna (se for tingir junto)",
      questions: [
        {
          id: "bl_vai_tingir",
          label: "Vai fazer tintura ou henna junto com a laminação hoje?",
          wantsDetail: false,
        },
        {
          id: "bl_reacao_tintura",
          label: "Já teve reação a tintura de cabelo/sobrancelha, henna ou tatuagem de henna preta?",
          wantsDetail: true,
          detailLabel: "Qual produto e que reação?",
          critical: true,
        },
        {
          id: "bl_alergia_ppd",
          label: "Sabe se tem alergia a PPD (parafenilenodiamina) ou a parabenos?",
          wantsDetail: true,
          detailLabel: "Como descobriu?",
          critical: true,
        },
      ],
    },
    {
      id: "bl_pele",
      title: "Pele da sobrancelha",
      questions: [
        {
          id: "bl_pele_condicao",
          label: "Tem dermatite, eczema, psoríase ou rosácea na testa/sobrancelha?",
          wantsDetail: true,
          detailLabel: "Qual condição e se está em crise?",
        },
        {
          id: "bl_ferida_ativa",
          label: "Tem ferida, corte, acne inflamada ou espinha na região das sobrancelhas hoje?",
          wantsDetail: true,
          detailLabel: "O quê e onde?",
        },
        {
          id: "bl_acidos_peeling",
          label: "Usou ácidos (retinol, AHA/BHA), fez peeling ou microagulhamento na testa nas últimas 2 semanas?",
          wantsDetail: true,
          detailLabel: "Qual e há quanto tempo?",
        },
        {
          id: "bl_procedimento_sobrancelha",
          label: "Fez micropigmentação, microblading, laser ou depilação na sobrancelha recentemente?",
          wantsDetail: true,
          detailLabel: "Qual e há quanto tempo?",
        },
      ],
    },
    {
      id: "bl_pelos",
      title: "Pelos da sobrancelha",
      questions: [
        {
          id: "bl_pelos_condicao",
          label: "Seus pelos são ralos, com falhas, danificados, ou você tem queda/alopecia?",
          wantsDetail: true,
          detailLabel: "Descreva",
        },
      ],
    },
    {
      id: "bl_teste",
      title: "Teste de sensibilidade",
      questions: [
        {
          id: "bl_patch_test",
          label: "Fez o teste de toque 48h antes deste atendimento?",
          wantsDetail: true,
          detailLabel: "Houve alguma reação?",
        },
      ],
    },
  ],

  HENNA: [
    {
      id: "hn_alergia_tintura",
      title: "Alergia a tintura, henna e PPD",
      questions: [
        {
          id: "hn_reacao_tintura_cabelo",
          label: "Já teve reação a tintura/coloração de cabelo (coceira, vermelhidão, inchaço, bolhas)?",
          wantsDetail: true,
          detailLabel: "Quando e que sintomas?",
          critical: true,
        },
        {
          id: "hn_henna_preta",
          label: "Já fez tatuagem de henna preta (de rua, praia ou viagem) e teve reação na pele?",
          wantsDetail: true,
          detailLabel: "Descreva a reação",
          critical: true,
        },
        {
          id: "hn_henna_sobrancelha_antes",
          label: "Já fez henna na sobrancelha e teve coceira, vermelhidão ou descamação depois?",
          wantsDetail: true,
          detailLabel: "Descreva e há quanto tempo",
          critical: true,
        },
        {
          id: "hn_alergia_ppd",
          label: "Tem alergia conhecida a PPD (parafenilenodiamina) ou a corantes de cabelo?",
          wantsDetail: true,
          detailLabel: "Como foi diagnosticada?",
          critical: true,
        },
        {
          id: "hn_reacao_parecidos",
          label:
            "Já reagiu a produtos com substâncias parecidas com PPD (tinta de roupa preta, borracha preta, anestésico com benzocaína, protetor com PABA)?",
          wantsDetail: true,
          detailLabel: "Qual produto e que reação?",
        },
      ],
    },
    {
      id: "hn_teste",
      title: "Teste de toque (obrigatório)",
      questions: [
        {
          id: "hn_patch_test",
          label: "Fez o teste de toque pelo menos 48h antes deste atendimento?",
          wantsDetail: true,
          detailLabel: "Quando fez e houve reação?",
          critical: true,
        },
      ],
    },
    {
      id: "hn_pele",
      title: "Pele da sobrancelha",
      questions: [
        {
          id: "hn_pele_condicao",
          label: "Tem dermatite, eczema, psoríase, rosácea ou pele muito sensível na testa/sobrancelha?",
          wantsDetail: true,
          detailLabel: "Qual condição e situação atual?",
        },
        {
          id: "hn_ferida_ativa",
          label: "Tem ferida, corte, espinha inflamada, descamação ou herpes nas sobrancelhas hoje?",
          wantsDetail: true,
          detailLabel: "Descreva",
        },
        {
          id: "hn_procedimento_recente",
          label: "Fez henna, micropigmentação, laser, peeling, cera ou depilação na sobrancelha recentemente?",
          wantsDetail: true,
          detailLabel: "Qual e há quanto tempo?",
        },
      ],
    },
    {
      id: "hn_saude",
      title: "Saúde específica",
      questions: [
        {
          id: "hn_g6pd",
          label: "Tem deficiência de G6PD (favismo) ou já teve anemia por hemólise?",
          wantsDetail: true,
          detailLabel: "Descreva",
        },
      ],
    },
  ],
};

// ── Composição e índices ──────────────────────────────────────────────────────

/** Grupos completos de uma ficha: os padrão mais os do procedimento. */
export function groupsForProcedure(procedure: AnamneseProcedure): AnamneseGroup[] {
  return [...SHARED_GROUPS, ...SPECIFIC_GROUPS[procedure]];
}

/** Todas as perguntas de todos os procedimentos, deduplicadas por id — usado
 *  para validar respostas e montar o índice. As padrão aparecem uma vez só. */
const allQuestions: AnamneseQuestion[] = (() => {
  const seen = new Map<string, AnamneseQuestion>();
  const groups = [
    ...SHARED_GROUPS,
    ...Object.values(SPECIFIC_GROUPS).flat(),
  ];
  for (const group of groups) {
    for (const q of group.questions) if (!seen.has(q.id)) seen.set(q.id, q);
  }
  return [...seen.values()];
})();

export const anamneseQuestionById = new Map(allQuestions.map((q) => [q.id, q]));
export const anamneseQuestionIds = allQuestions.map((q) => q.id);

/**
 * Termo que a cliente aceita ao assinar. Fica no código (não no banco) porque é
 * parte do documento, mas a versão vigente é congelada em cada ficha assinada.
 */
export const CLIENT_DECLARATION =
  "Declaro que as informações prestadas são verdadeiras e assumo a responsabilidade por " +
  "elas. Estou ciente dos cuidados e das possíveis reações do procedimento e autorizo a " +
  "profissional a realizá-lo. Autorizo também o tratamento dos meus dados pessoais e de " +
  "saúde para fins do atendimento, conforme a Lei Geral de Proteção de Dados (LGPD).";

/**
 * Responsável técnica que assina as fichas. Valores congelados em cada ficha no
 * momento da assinatura — mudar aqui não reescreve documentos já assinados.
 */
export const RESPONSIBLE_PROFESSIONAL = {
  name: "Iandeyara Delamare Fernandes de Souza Vrubleski",
  document: "61.418.546/0001-51",
  documentLabel: "CNPJ",
  title: "Lash Designer responsável",
} as const;
