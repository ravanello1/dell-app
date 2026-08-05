/**
 * Catálogo das perguntas da anamnese.
 *
 * As perguntas moram no código, não no banco: são poucas, mudam raramente e
 * precisam de rótulo, agrupamento e a lógica de "se sim, detalhe qual". A ficha
 * guarda só as respostas, referenciando cada pergunta pelo `id`. Assim a mesma
 * ficha antiga continua legível mesmo que o texto de uma pergunta seja ajustado,
 * e a tela de impressão itera este catálogo para montar o documento.
 *
 * Mudou uma pergunta? Nunca reaproveite um `id` antigo para outra pergunta —
 * isso reinterpretaria respostas já assinadas. Aposente o id e crie um novo.
 */

export interface AnamneseQuestion {
  id: string;
  label: string;
  /** Quando respondida "sim", abre um campo para detalhar. */
  wantsDetail: boolean;
  detailLabel?: string;
}

export interface AnamneseGroup {
  id: string;
  title: string;
  questions: AnamneseQuestion[];
}

export const anamneseGroups: AnamneseGroup[] = [
  {
    id: "gestacao",
    title: "Gestação e amamentação",
    questions: [
      { id: "gestante", label: "Está gestante?", wantsDetail: true, detailLabel: "De quantas semanas?" },
      { id: "lactante", label: "Está amamentando?", wantsDetail: false },
    ],
  },
  {
    id: "alergias",
    title: "Alergias e reações",
    questions: [
      {
        id: "alergia_cosmeticos",
        label: "Tem alergia a algum cosmético ou produto?",
        wantsDetail: true,
        detailLabel: "Qual produto?",
      },
      {
        id: "alergia_cianoacrilato",
        label: "Já teve reação à cola de cílios (cianoacrilato)?",
        wantsDetail: true,
        detailLabel: "Como foi a reação?",
      },
      {
        id: "alergia_esparadrapo",
        label: "Tem alergia a esparadrapo, fita ou adesivos na pele?",
        wantsDetail: false,
      },
    ],
  },
  {
    id: "olhos",
    title: "Olhos",
    questions: [
      { id: "lentes_contato", label: "Usa lentes de contato?", wantsDetail: false },
      {
        id: "problema_ocular",
        label: "Tem ou teve problema nos olhos (conjuntivite, glaucoma, blefarite, terçol)?",
        wantsDetail: true,
        detailLabel: "Qual?",
      },
      {
        id: "cirurgia_ocular",
        label: "Fez cirurgia ocular nos últimos 6 meses?",
        wantsDetail: true,
        detailLabel: "Qual e quando?",
      },
      {
        id: "olhos_sensiveis",
        label: "Tem olhos sensíveis ou que lacrimejam com facilidade?",
        wantsDetail: false,
      },
      {
        id: "queda_cilios",
        label: "Tem queda de cílios ou hábito de puxá-los?",
        wantsDetail: false,
      },
    ],
  },
  {
    id: "saude_geral",
    title: "Saúde geral",
    questions: [
      {
        id: "medicacao_continua",
        label: "Faz uso de alguma medicação contínua?",
        wantsDetail: true,
        detailLabel: "Qual medicação?",
      },
      {
        id: "doenca_cronica",
        label: "Tem doença autoimune, diabetes ou problema de tireoide?",
        wantsDetail: true,
        detailLabel: "Qual?",
      },
      { id: "hipertensao", label: "É hipertensa?", wantsDetail: false },
      {
        id: "tratamento_oncologico",
        label: "Está em tratamento oncológico (quimio ou radioterapia)?",
        wantsDetail: false,
      },
      {
        id: "acidos_dermatologico",
        label: "Usa ácidos, Roacutan ou faz tratamento dermatológico na região dos olhos?",
        wantsDetail: true,
        detailLabel: "Qual?",
      },
    ],
  },
  {
    id: "historico",
    title: "Histórico do procedimento",
    questions: [
      {
        id: "extensao_anterior",
        label: "Já fez extensão de cílios antes?",
        wantsDetail: true,
        detailLabel: "Qual técnica e há quanto tempo?",
      },
      {
        id: "quimica_recente",
        label: "Fez alguma química nos cílios recentemente (lifting, permanente, botox)?",
        wantsDetail: true,
        detailLabel: "Qual e quando?",
      },
    ],
  },
];

/** Todas as perguntas achatadas, na ordem de exibição. */
export const anamneseQuestions: AnamneseQuestion[] = anamneseGroups.flatMap((g) => g.questions);

/** Índice id → pergunta, para validar respostas e montar a impressão. */
export const anamneseQuestionById = new Map(anamneseQuestions.map((q) => [q.id, q]));

export const anamneseQuestionIds = anamneseQuestions.map((q) => q.id);

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
 * Editável na tela de Ajustes no futuro; por ora é a identidade fixa do studio.
 */
export const RESPONSIBLE_PROFESSIONAL = {
  name: "Iandeyara Delamare Fernandes de Souza Vrubleski",
  document: "61.418.546/0001-51",
  documentLabel: "CNPJ",
  title: "Lash Designer responsável",
} as const;
