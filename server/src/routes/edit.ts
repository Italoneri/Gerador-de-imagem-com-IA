import { Router, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { env, maxUploadBytes } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { getImageEditProvider } from "../providers/registry.js";
import { validateEditRequest } from "./validateEditRequest.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 1 },
});

/**
 * Multer sinaliza estouro de tamanho com um erro próprio. Traduzimos aqui para
 * o usuário receber "a imagem passou de X MB" e não um 500 genérico.
 */
function receiveImage(req: Request, res: Response, next: NextFunction): void {
  upload.single("image")(req, res, (cause: unknown) => {
    if (cause instanceof MulterError) {
      next(
        cause.code === "LIMIT_FILE_SIZE"
          ? new AppError("ARQUIVO_GRANDE", `limite ${env.MAX_UPLOAD_MB} MB`)
          : new AppError("IMAGEM_INVALIDA", cause.code),
      );
      return;
    }
    next(cause);
  });
}

/**
 * Prazo total da edição. O sinal desce até o `fetch` do provedor, então quando
 * estoura — ou quando o usuário fecha a aba — a chamada externa é cancelada de
 * verdade, sem deixar requisição órfã queimando crédito.
 */
function requestDeadline(req: Request): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);
  const stop = () => {
    clearTimeout(timer);
    controller.abort();
  };
  req.on("close", () => {
    if (!req.readableEnded) stop();
  });
  req.on("end", () => clearTimeout(timer));
  return controller.signal;
}

export const editRouter: Router = Router();

editRouter.post(
  "/edit",
  receiveImage,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await validateEditRequest(req.file, req.body);
      if (!validated.ok) throw new AppError(validated.error);

      const provider = getImageEditProvider();
      const result = await provider.editImage({
        image: validated.value.image,
        mimeType: validated.value.mimeType,
        prompt: validated.value.prompt,
        seed: validated.value.seed,
        signal: requestDeadline(req),
      });

      res
        .status(200)
        .setHeader("content-type", result.mimeType)
        .setHeader("cache-control", "no-store")
        .send(result.image);
    } catch (cause) {
      next(cause);
    }
  },
);
