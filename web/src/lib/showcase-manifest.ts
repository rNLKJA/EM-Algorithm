import manifestJson from "./showcase-manifest.json";
import type { WalkthroughId } from "./showcase";

/** Written by scripts/showcase-media.mjs after each tour run. */
export interface ShowcaseManifest {
  walkthroughs: Partial<
    Record<
      WalkthroughId,
      {
        /** Length of the MP4 in seconds. */
        duration: number;
        /** Size of the MP4 in bytes. */
        bytes: number;
        /** When each step's caption appears, in seconds into the MP4. */
        cues: number[];
      }
    >
  >;
  screenshots: Record<
    string,
    { width: number; height: number; thumbWidth: number; thumbHeight: number }
  >;
}

export const MANIFEST: ShowcaseManifest = manifestJson;
