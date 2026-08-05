import { expect, test, type Page } from "@playwright/test";

/**
 * O caminho que o studio percorre de verdade num dia: entrar, cadastrar uma
 * cliente, marcar o horário dela, esbarrar num conflito e dar baixa no estoque.
 *
 * Cada teste cria os próprios dados com sufixo único, para as duas execuções
 * (desktop e celular) não disputarem os mesmos registros.
 */

const EMAIL = process.env.SEED_OWNER_EMAIL ?? "contato@dellbeautystudio.com.br";
const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "";

/** Sufixo estável por execução, para os nomes não colidirem entre projetos. */
function uniqueSuffix(testInfo: { project: { name: string }; workerIndex: number }) {
  return `${testInfo.project.name}-${testInfo.workerIndex}-${process.pid}`;
}

/**
 * Cada execução ganha o seu próprio dia na agenda.
 *
 * Sem isso, desktop e celular marcariam no mesmo dia e o segundo esbarraria no
 * agendamento do primeiro — a regra de conflito funcionaria, mas o teste
 * acusaria falha no lugar errado. O studio tem uma profissional só, então o dia
 * é o recurso disputado.
 */
function diaExclusivo(suffix: string): string {
  let hash = 0;
  for (const char of suffix) hash = (hash * 31 + char.charCodeAt(0)) % 300;
  const base = new Date(Date.UTC(2027, 0, 4)); // uma segunda-feira
  base.setUTCDate(base.getUTCDate() + hash);
  return base.toISOString().slice(0, 10);
}

async function entrar(page: Page) {
  await page.goto("/login");
  // Pelo atributo `name`: o rótulo visível carrega o asterisco de obrigatório,
  // e "Senha" por acessibilidade também casaria com o botão "Mostrar senha".
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible({ timeout: 20_000 });
}

test.beforeAll(() => {
  if (!PASSWORD) {
    throw new Error(
      "SEED_OWNER_PASSWORD não definida. Rode `npm run db:seed` e confira o .env.local.",
    );
  }
});

test.describe("Dell App", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("o painel mostra o resumo do dia", async ({ page }) => {
    await expect(page.getByText("atendimentos hoje")).toBeVisible();
    await expect(page.getByText("clientes ativas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agenda de hoje" })).toBeVisible();
  });

  test("cadastra uma cliente e a encontra pela busca", async ({ page }, testInfo) => {
    const suffix = uniqueSuffix(testInfo);
    const nome = `Cliente Teste ${suffix}`;
    // Telefone derivado do pid para não colidir com o de outra execução.
    const telefone = `4198${String(process.pid).padStart(7, "0").slice(-7)}`;

    await page.goto("/clientes/nova");
    await page.getByLabel("Nome completo").fill(nome);
    await page.getByLabel("WhatsApp / telefone").fill(telefone);
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();

    // Foi para a ficha da cliente recém-criada.
    await expect(page.getByRole("heading", { name: nome })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Atendimentos" })).toBeVisible();

    // E aparece na busca da listagem.
    await page.goto("/clientes");
    await page.getByLabel("Buscar cliente").fill(nome);
    await expect(page.getByText(nome)).toBeVisible({ timeout: 20_000 });
  });

  test("recusa telefone já cadastrado para outra cliente", async ({ page }, testInfo) => {
    const suffix = uniqueSuffix(testInfo);
    const telefone = `4197${String(process.pid).padStart(7, "0").slice(-7)}`;

    for (const rotulo of ["Primeira", "Segunda"]) {
      await page.goto("/clientes/nova");
      await page.getByLabel("Nome completo").fill(`${rotulo} Pessoa ${suffix}`);
      await page.getByLabel("WhatsApp / telefone").fill(telefone);
      await page.getByRole("button", { name: "Cadastrar cliente" }).click();

      if (rotulo === "Primeira") {
        await expect(page.getByRole("heading", { name: `Primeira Pessoa ${suffix}` })).toBeVisible({
          timeout: 20_000,
        });
      }
    }

    // A segunda tentativa é barrada, e a mensagem diz de quem é o número.
    await expect(page.getByText(/já está cadastrado para/i)).toBeVisible({ timeout: 20_000 });
  });

  test("a agenda navega entre dia, semana e mês", async ({ page }) => {
    await page.goto("/agenda");

    await expect(page.getByRole("tab", { name: "dia" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: "mês" }).click();
    await expect(page.getByRole("tab", { name: "mês" })).toHaveAttribute("aria-selected", "true");
    // A grade do mês tem os sete dias da semana no cabeçalho.
    await expect(page.getByText("seg", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "semana" }).click();
    await expect(page.getByRole("tab", { name: "semana" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // O estado da visão fica na URL, então recarregar não perde o lugar.
    await page.reload();
    await expect(page.getByRole("tab", { name: "semana" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("bloqueia dois atendimentos no mesmo horário", async ({ page }, testInfo) => {
    const suffix = uniqueSuffix(testInfo);
    const nome = `Agenda Teste ${suffix}`;
    const telefone = `4196${String(process.pid).padStart(7, "0").slice(-7)}`;

    // Uma cliente só para este teste.
    await page.goto("/clientes/nova");
    await page.getByLabel("Nome completo").fill(nome);
    await page.getByLabel("WhatsApp / telefone").fill(telefone);
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
    await expect(page.getByRole("heading", { name: nome })).toBeVisible({ timeout: 20_000 });

    // Dia no futuro e exclusivo desta execução.
    const dia = diaExclusivo(suffix);

    async function marcar(hora: string) {
      await page.goto("/agenda");
      await page.getByRole("button", { name: /Novo/ }).first().click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // A busca filtra a lista, então o índice 1 é a cliente (o 0 é o
      // "Selecione a cliente").
      await dialog.getByLabel("Buscar cliente").fill(nome);
      const seletorCliente = dialog.getByRole("combobox").first();
      await expect(seletorCliente.locator("option", { hasText: nome })).toHaveCount(1);
      await seletorCliente.selectOption({ index: 1 });

      // Segundo combobox: procedimento.
      await dialog.getByRole("combobox").nth(1).selectOption({ index: 1 });

      await dialog.getByLabel("Data").fill(dia);
      await dialog.getByLabel("Início").fill(hora);
      await dialog.getByRole("button", { name: "Marcar atendimento" }).click();
    }

    await marcar("10:00");
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20_000 });

    // O mesmo horário, com a mesma profissional, precisa ser recusado.
    await marcar("10:30");
    await expect(page.getByText("Horário ocupado")).toBeVisible({ timeout: 20_000 });
  });

  test("registra movimento de estoque e mostra o saldo novo", async ({ page }, testInfo) => {
    const suffix = uniqueSuffix(testInfo);
    const produto = `Produto Teste ${suffix}`;

    await page.goto("/estoque");
    await page.getByRole("button", { name: /Novo/ }).click();

    const cadastro = page.getByRole("dialog");
    await cadastro.getByLabel("Nome").fill(produto);
    await cadastro.getByLabel("Quantidade inicial").fill("10");
    await cadastro.getByLabel("Estoque mínimo").fill("3");
    await cadastro.getByRole("button", { name: "Cadastrar" }).click();
    await expect(cadastro).toBeHidden({ timeout: 20_000 });

    // Busca o produto e abre o diálogo de movimento dele.
    await page.getByLabel("Buscar produto").fill(produto);
    const linha = page.getByRole("listitem").filter({ hasText: produto });
    await expect(linha).toBeVisible({ timeout: 20_000 });
    await linha.getByRole("button", { name: /Movimentar/ }).click();

    const movimento = page.getByRole("dialog");
    await expect(movimento.getByText("Saldo atual:")).toBeVisible();

    await movimento.getByRole("button", { name: /Saída/ }).click();
    await movimento.getByLabel(/Quantidade/).fill("4");
    // A prévia calcula o saldo antes de salvar.
    await expect(movimento.getByText(/Saldo depois:/)).toBeVisible();
    await movimento.getByRole("button", { name: "Registrar" }).click();
    await expect(movimento).toBeHidden({ timeout: 20_000 });

    // 10 − 4 = 6
    await expect(linha.getByLabel(/^Saldo: 6 /)).toBeVisible({ timeout: 20_000 });
  });

  test("recusa saída maior que o saldo disponível", async ({ page }, testInfo) => {
    const suffix = uniqueSuffix(testInfo);
    const produto = `Saldo Teste ${suffix}`;

    await page.goto("/estoque");
    await page.getByRole("button", { name: /Novo/ }).click();

    const cadastro = page.getByRole("dialog");
    await cadastro.getByLabel("Nome").fill(produto);
    await cadastro.getByLabel("Quantidade inicial").fill("2");
    await cadastro.getByRole("button", { name: "Cadastrar" }).click();
    await expect(cadastro).toBeHidden({ timeout: 20_000 });

    await page.getByLabel("Buscar produto").fill(produto);
    const linha = page.getByRole("listitem").filter({ hasText: produto });
    await linha.getByRole("button", { name: /Movimentar/ }).click();

    const movimento = page.getByRole("dialog");
    await movimento.getByRole("button", { name: /Saída/ }).click();
    await movimento.getByLabel(/Quantidade/).fill("99");
    await movimento.getByRole("button", { name: "Registrar" }).click();

    // A mensagem aponta a saída certa: usar o ajuste de inventário.
    await expect(movimento.getByText(/Ajuste de inventário/)).toBeVisible({ timeout: 20_000 });
  });

  test("sem sessão, a API responde 401 em JSON", async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.request.get("/api/v1/clients");
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });
});
