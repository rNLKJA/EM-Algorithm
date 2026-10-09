"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ORDER = ["system", "light", "dark"] as const;
const LABEL = { system: "System theme", light: "Paper (light)", dark: "Blackboard (dark)" };

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Avoid a hydration mismatch: the stored theme is only known on the client.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const current = (mounted ? theme : "system") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(next)}
          aria-label={`Theme: ${LABEL[current]}. Switch to ${LABEL[next]}`}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{LABEL[current]}</TooltipContent>
    </Tooltip>
  );
}
