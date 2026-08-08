import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// O .env fica na raiz do repositório, um nível acima de `server/`. Vale tanto
// rodando via tsx (src/config/) quanto compilado (dist/config/) — mesma
// profundidade nos dois casos.
const rootEnvFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export const PROVIDER_IDS = ["bfl", "gemini", "nim"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Qual variável guarda a chave de cada provedor — usado na checagem de boot. */
const API_KEY_VAR: Record<ProviderId, string> = {
  bfl: "BFL_API_KEY",
  gemini: "GEMINI_API_KEY",
  nim: "NVIDIA_NIM_API_KEY",
};

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(8787),
    CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),

    IMAGE_PROVIDER: z.enum(PROVIDER_IDS).default("bfl"),

    BFL_API_KEY: z.string().min(1).optional(),
    BFL_MODEL: z.string().min(1).default("flux-kontext-pro"),

    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-3.1-flash-image"),

    NVIDIA_NIM_API_KEY: z.string().min(1).optional(),
    NVIDIA_NIM_MODEL: z
      .string()
      .min(1)
      .default("black-forest-labs/flux.1-kontext-dev"),
    NVIDIA_NIM_BASE_URL: z
      .string()
      .url()
      .default("https://ai.api.nvidia.com/v1/genai"),

    MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(15),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  })
  // Só a chave do provedor escolhido é obrigatória: quem usa BFL não precisa
  // ter conta no Gemini para o servidor subir.
  .superRefine((env, ctx) => {
    const keyVar = API_KEY_VAR[env.IMAGE_PROVIDER];
    if (process.env[keyVar]) return;
    ctx.addIssue({
      code: "custom",
      path: [keyVar],
      message: `IMAGE_PROVIDER="${env.IMAGE_PROVIDER}" exige ${keyVar}. Preencha no .env (veja .env.example).`,
    });
  });

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (parsed.success) return parsed.data;

  // Falha no boot, não na primeira requisição: subir um servidor que só quebra
  // quando o usuário já mandou a foto é pior que não subir.
  const problems = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Configuração inválida:\n${problems}`);
}

export const env: Env = parseEnv();

export const maxUploadBytes = Math.round(env.MAX_UPLOAD_MB * 1024 * 1024);
