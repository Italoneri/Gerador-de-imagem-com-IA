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

const app = express();
app.disable("x-powered-by");
app.use(helmet());
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

app.listen(env.PORT, () => {
  console.log(
    JSON.stringify({
      level: "info",
      operation: "boot",
      port: env.PORT,
      provider: env.IMAGE_PROVIDER,
    }),
  );
});
