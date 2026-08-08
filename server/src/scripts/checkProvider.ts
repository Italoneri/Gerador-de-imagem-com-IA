/**
 * Confere se a chave configurada realmente edita uma imagem.
 *
 *   npm run check:provider
 *
 * Existe para você descobrir que a chave está errada aqui, num comando de dois
 * segundos, e não por um balão de erro no browser depois do deploy. Usa o mesmo
 * registry e o mesmo vocabulário de erros do servidor — se passa aqui, passa lá.
 */
import { AppError } from "../errors/AppError.js";

// `config/env.js` valida e lança na importação. Como este script existe para
// diagnosticar, o import é dinâmico: assim a falta de chave vira uma mensagem
// legível em vez de um stack trace do Node.
const { env } = await import("../config/env.js").catch((cause: unknown) => {
  console.error("❌ configuração inválida — nem cheguei a chamar o provedor.\n");
  console.error(cause instanceof Error ? cause.message : String(cause));
  console.error("\n   Copie .env.example para .env e preencha a chave do provedor.");
  process.exit(1);
});
const { getImageEditProvider } = await import("../providers/registry.js");

/** PNG 2×2 com quatro cores chapadas. Pequeno de propósito: gasta o mínimo. */
const TEST_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAHElEQVQI12P8z8Dwn4EIwESMotFHYwEAQOwF8QU2s7cAAAAASUVORK5CYII=";

const PROMPT = "deixe esta imagem em tons de cinza";

/** Cada código vira uma instrução do que fazer, não só o nome do problema. */
const NEXT_STEP: Record<string, string> = {
  CONFIG_INVALIDA:
    "A chave está ausente, malformada ou foi recusada. Confira o valor no .env — sem espaços, sem aspas.",
  SEM_CREDITO:
    "A conta ficou sem crédito. Recarregue no painel do provedor e rode de novo.",
  LIMITE_EXCEDIDO:
    "Rate limit do provedor. Espere um minuto e tente de novo.",
  TIMEOUT:
    "O provedor não respondeu no prazo. Pode ser instabilidade momentânea — tente de novo.",
  SEM_REDE:
    "Não consegui alcançar o provedor. Confira a saída de rede da máquina (proxy, DNS, firewall).",
  CONTEUDO_BLOQUEADO:
    "O filtro de conteúdo barrou até o prompt de teste. Estranho: verifique se o modelo em uso aceita edição.",
  RESPOSTA_INVALIDA:
    "O provedor respondeu num formato inesperado. Confira se o modelo configurado aceita imagem de entrada.",
  PROVEDOR_FORA: "O provedor está fora do ar ou devolveu erro interno.",
};

const modelFor = (): string =>
  ({
    bfl: env.BFL_MODEL,
    gemini: env.GEMINI_MODEL,
    nim: env.NVIDIA_NIM_MODEL,
  })[env.IMAGE_PROVIDER];

async function main(): Promise<number> {
  console.log(`provedor : ${env.IMAGE_PROVIDER}`);
  console.log(`modelo   : ${modelFor()}`);
  console.log(`timeout  : ${env.REQUEST_TIMEOUT_MS} ms`);
  console.log("\nmandando uma edição de teste…\n");

  const startedAt = Date.now();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const provider = getImageEditProvider();
    const result = await provider.editImage({
      image: Buffer.from(TEST_PNG_BASE64, "base64"),
      mimeType: "image/png",
      prompt: PROMPT,
      seed: undefined,
      signal: controller.signal,
    });

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log("✅ funcionou.");
    console.log(`   voltou ${result.image.byteLength} bytes de ${result.mimeType} em ${seconds}s`);
    console.log("\nPode seguir para o deploy.");
    return 0;
  } catch (cause) {
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const error =
      cause instanceof AppError
        ? cause
        : new AppError(
            "PROVEDOR_FORA",
            cause instanceof Error ? cause.message : String(cause),
          );

    console.error(`❌ falhou depois de ${seconds}s — ${error.code}`);
    if (error.detail) console.error(`   detalhe: ${error.detail}`);
    const step = NEXT_STEP[error.code];
    if (step) console.error(`\n   ${step}`);
    return 1;
  } finally {
    clearTimeout(deadline);
  }
}

process.exitCode = await main();
