import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { AppError } from "./errors/AppError.js";
import { editRouter } from "./routes/edit.js";

const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const SHUTDOWN_GRACE_MS = 10_000;

const isProduction = env.NODE_ENV === "production";

// Em produção o Express serve o front construído; em dev quem serve é o Vite.
// O caminho sobe de server/dist/ até a raiz do repositório — mesmo layout dentro
// da imagem Docker, então vale nos dois lugares.
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));

const app = express();
app.disable("x-powered-by");

// Atrás do Caddy, o IP de todo mundo chega como o do proxy. Sem isto o
// express-rate-limit trataria a internet inteira como um cliente só, e o
// primeiro visitante queimaria a cota de todos.
if (isProduction) app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // O padrão do helmet é `img-src 'self' data:`. O app inteiro exibe
        // imagem por URL.createObjectURL(), que gera `blob:` — sem esta linha
        // toda foto do chat, da galeria e do editor some em produção.
        "img-src": ["'self'", "data:", "blob:"],
      },
    },
  }),
);

// Origem única em produção: o front chama /api no mesmo host, então CORS só
// importa se alguém expuser a API separadamente.
app.use(cors({ origin: env.CORS_ORIGIN }));

app.get("/health", (_req: Request, res: Response) => {
  // Diz qual provedor está ativo e se a chave chegou — nunca o valor dela.
  res.json({ ok: true, provider: env.IMAGE_PROVIDER });
});

app.use(
  "/api",
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "LIMITE_EXCEDIDO" } });
    },
  }),
  editRouter,
);

if (isProduction) {
  if (!existsSync(webDist)) {
    throw new Error(
      `NODE_ENV=production mas ${webDist} não existe. Rode "npm run build" antes de subir.`,
    );
  }

  // Assets têm hash no nome, então podem ficar em cache por um ano. O index.html
  // não pode: é ele que aponta para o hash novo depois de cada deploy.
  app.use(express.static(webDist, { index: false, maxAge: "1y" }));

  // Fallback de SPA. `/{*splat}` é a sintaxe do Express 5 — o `"*"` do Express 4
  // lança erro de rota, e `/*splat` sem as chaves não casa a raiz.
  //
  // O arquivo vai como nome relativo + `root`, e não como caminho absoluto: no
  // Windows o `sendFile` com caminho absoluto responde 404, e esta é a forma
  // que o Express documenta.
  app.get("/{*splat}", (_req: Request, res: Response) => {
    res.setHeader("cache-control", "no-cache");
    res.sendFile("index.html", { root: webDist });
  });
}

const handleError: ErrorRequestHandler = (cause, _req, res, _next) => {
  const error =
    cause instanceof AppError
      ? cause
      : new AppError(
          "PROVEDOR_FORA",
          cause instanceof Error ? cause.message : String(cause),
        );

  // Log estruturado, sem PII e sem chave. `detail` fica só aqui.
  console.error(
    JSON.stringify({
      level: "error",
      operation: "edit",
      code: error.code,
      status: error.status,
      detail: error.detail ?? null,
    }),
  );

  if (res.headersSent) return;
  res.status(error.status).json({ error: { code: error.code } });
};

app.use(handleError);

const server = app.listen(env.PORT, () => {
  console.log(
    JSON.stringify({
      level: "info",
      operation: "boot",
      port: env.PORT,
      provider: env.IMAGE_PROVIDER,
      servingWeb: isProduction,
    }),
  );
});

/**
 * Uma edição pode levar 30 s. No `docker compose down` o container recebe
 * SIGTERM: paramos de aceitar conexão nova, deixamos as em andamento
 * terminarem, e só derrubamos à força se passarem do prazo.
 */
function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: "info", operation: "shutdown", signal }));

  const forced = setTimeout(() => {
    console.error(
      JSON.stringify({ level: "error", operation: "shutdown", reason: "timeout" }),
    );
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forced.unref();

  server.close(() => {
    clearTimeout(forced);
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
