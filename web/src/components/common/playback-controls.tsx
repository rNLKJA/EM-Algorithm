"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  onReset: () => void;
  onPrev: () => void;
  onToggle: () => void;
  onNext: () => void;
  onEnd?: () => void;
  nextLabel?: string;
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={primary ? "default" : "outline"}
          size="icon-lg"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={primary ? "size-10 rounded-full" : "rounded-full"}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function PlaybackControls({
  playing,
  atStart,
  atEnd,
  onReset,
  onPrev,
  onToggle,
  onNext,
  onEnd,
  nextLabel = "Next step",
}: Props) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Playback">
      <IconButton label="Back to the start" onClick={onReset} disabled={atStart && !playing}>
        <RotateCcw />
      </IconButton>
      <IconButton label="Previous step" onClick={onPrev} disabled={atStart}>
        <ChevronLeft />
      </IconButton>
      <IconButton label={playing ? "Pause" : atEnd ? "Replay" : "Play"} onClick={onToggle} primary>
        {playing ? <Pause /> : <Play className="translate-x-px" />}
      </IconButton>
      <IconButton label={nextLabel} onClick={onNext} disabled={atEnd}>
        <ChevronRight />
      </IconButton>
      {onEnd && (
        <IconButton label="Jump to the end" onClick={onEnd} disabled={atEnd}>
          <SkipForward />
        </IconButton>
      )}
    </div>
  );
}
