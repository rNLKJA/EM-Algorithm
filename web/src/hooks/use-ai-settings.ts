"use client";

import { useSyncExternalStore } from "react";
import { aiSettingsVersion, keyStore, subscribeAiSettings } from "@/lib/ai/key-store";
import { DEFAULT_SETTINGS } from "@/lib/ai/models";
import type { AiSettings, Provider } from "@/lib/ai/types";

export interface AiSettingsState {
  /** false during server rendering and the first client render */
  ready: boolean;
  settings: AiSettings;
  keyLocation: Record<Provider, "session" | "device" | null>;
  /** true when the selected provider has a key */
  hasKey: boolean;
}

/**
 * Reactive view of the bring-your-own-key settings. The key itself is NOT
 * exposed here; it is read from storage only at the moment a call is made.
 */
export function useAiSettings(): AiSettingsState {
  const version = useSyncExternalStore(subscribeAiSettings, aiSettingsVersion, () => -1);
  if (version === -1) {
    return {
      ready: false,
      settings: DEFAULT_SETTINGS,
      keyLocation: { anthropic: null, openai: null },
      hasKey: false,
    };
  }
  const settings = keyStore.getSettings();
  const keyLocation = {
    anthropic: keyStore.keyLocation("anthropic"),
    openai: keyStore.keyLocation("openai"),
  };
  return { ready: true, settings, keyLocation, hasKey: keyLocation[settings.provider] !== null };
}

/* A tiny global switch so any component can open the single settings dialog. */
let dialogOpen = false;
const listeners = new Set<() => void>();

export function setAiSettingsOpen(open: boolean) {
  dialogOpen = open;
  listeners.forEach((l) => l());
}

export function openAiSettings() {
  setAiSettingsOpen(true);
}

export function useAiSettingsOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => dialogOpen,
    () => false,
  );
}
