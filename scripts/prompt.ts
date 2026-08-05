/**
 * Leitura de senha pelo terminal, sem ecoar o que foi digitado.
 *
 * Existe para que nenhuma senha real precise passar por um arquivo, por uma
 * variável de ambiente ou pelo histórico do shell: ela vai direto do teclado
 * para o bcrypt.
 */

const ENTER = ["\r", "\n"];
const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = ["\u007f", "\b"];

function readHidden(label: string): Promise<string> {
  process.stdout.write(label);

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      reject(
        new Error(
          "Este comando precisa de um terminal interativo — rode-o direto no seu Terminal.",
        ),
      );
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";

    const finish = (result: string | null) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (result === null) process.exit(130);
      else resolve(result);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (ENTER.includes(char) || char === CTRL_D) {
          finish(value);
          return;
        }
        if (char === CTRL_C) {
          finish(null);
          return;
        }
        if (BACKSPACE.includes(char)) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (char >= " ") {
          value += char;
          process.stdout.write("•");
        }
      }
    };

    stdin.on("data", onData);
  });
}

/**
 * Pede a senha duas vezes e só devolve quando as duas baterem e o tamanho
 * mínimo for respeitado.
 */
export async function promptNewPassword(minLength = 8): Promise<string> {
  for (;;) {
    const first = await readHidden("  Senha: ");

    if (first.length < minLength) {
      console.log(`\n  ✗ Use pelo menos ${minLength} caracteres.\n`);
      continue;
    }

    const second = await readHidden("  Repita: ");

    if (first !== second) {
      console.log("\n  ✗ As senhas não conferem. Vamos de novo.\n");
      continue;
    }

    return first;
  }
}
