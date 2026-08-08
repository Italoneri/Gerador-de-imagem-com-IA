import { env, type ProviderId } from "../config/env.js";
import { createBflProvider } from "./bfl.js";
import { createGeminiProvider } from "./gemini.js";
import { createNimProvider } from "./nvidiaNim.js";
import type { ImageEditProvider } from "./types.js";

/**
 * Mapa em vez de switch: acrescentar um provedor é acrescentar uma linha aqui
 * e um id em PROVIDER_IDS. Nenhum `if` espalhado pelo servidor.
 */
const FACTORIES: Readonly<Record<ProviderId, () => ImageEditProvider>> = {
  bfl: createBflProvider,
  gemini: createGeminiProvider,
  nim: createNimProvider,
};

let instance: ImageEditProvider | undefined;

export function getImageEditProvider(): ImageEditProvider {
  instance ??= FACTORIES[env.IMAGE_PROVIDER]();
  return instance;
}
