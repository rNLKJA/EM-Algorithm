/**
 * The precomputed inference results (see artefact.ts and settings.ts). Pages
 * import this instead of re-running minutes of simulation at build time.
 */
import raw from "./__generated__/inference.json";
import type { InferenceArtefact } from "./artefact";

export const inference = raw as unknown as InferenceArtefact;
