import { cn } from "@/lib/utils";

/**
 * Six procedurally drawn sigils — no image files, no emoji. Each is plain ink
 * linework so it sits on parchment like a stamped mark rather than a sticker.
 */

export const SIGIL_KEYS = ["compass", "tower", "leaf", "anvil", "moon", "key"] as const;
export type SigilKey = (typeof SIGIL_KEYS)[number];

const PATHS: Record<SigilKey, React.ReactNode> = {
  compass: (
    <>
      <circle cx="32" cy="32" r="20" />
      <path d="M32 12v6M32 46v6M12 32h6M46 32h6" />
      <path d="M24 40l6-16 10 8-16 8z" />
    </>
  ),
  tower: (
    <>
      <path d="M22 52V22l10-8 10 8v30" />
      <path d="M22 34h20M28 52V42h8v10" />
      <path d="M32 14v-6" />
    </>
  ),
  leaf: (
    <>
      <path d="M32 52C18 44 16 26 32 12c16 14 14 32 0 40z" />
      <path d="M32 52V18" />
      <path d="M32 30l8-6M32 38l-8-6" />
    </>
  ),
  anvil: (
    <>
      <path d="M14 26h28l-4 10H22z" />
      <path d="M28 36v8h-6v6h20v-6h-6v-8" />
      <path d="M42 26l8-4" />
    </>
  ),
  moon: (
    <>
      <path d="M40 12a20 20 0 100 40 24 24 0 010-40z" />
      <circle cx="44" cy="22" r="2" />
      <circle cx="48" cy="40" r="1.5" />
    </>
  ),
  key: (
    <>
      <circle cx="24" cy="24" r="10" />
      <path d="M31 31l17 17M42 42l5 5M38 46l4 4" />
    </>
  ),
};

export function AvatarSigil({
  sigil,
  size = 48,
  className,
  tone = "var(--foreground)",
}: {
  sigil: string;
  size?: number;
  className?: string;
  tone?: string;
}) {
  const key = (SIGIL_KEYS as readonly string[]).includes(sigil) ? (sigil as SigilKey) : "compass";

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn(className)}
      fill="none"
      stroke={tone}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`${key} sigil`}
    >
      {PATHS[key]}
    </svg>
  );
}
