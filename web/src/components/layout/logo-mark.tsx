/** Two overlapping bell curves: component 1 (teal, solid) and component 2 (coral, dashed). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 28" aria-hidden="true" className={className} fill="none">
      <path
        d="M2 24 C 8 24, 9 6, 15 6 S 22 24, 28 24"
        stroke="var(--comp-1)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M12 24 C 18 24, 20 11, 25 11 S 32 24, 38 24"
        stroke="var(--comp-2)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="3.2 3"
      />
      <path d="M1 25.5 H39" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" />
    </svg>
  );
}
