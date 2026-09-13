import { useEffect, useRef, useState } from "react";
import { Brain, Compass, Flame, Hammer, HeartPulse, Sparkles, Zap, X } from "lucide-react";

import { ATTRIBUTES, ATTRIBUTE_ORDER, tierForXp, type AttributeKey } from "@/engine/gameRules";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

type Zone = {
  key: AttributeKey | "HOME";
  label: string;
  name: string;
  gx: number;
  gy: number;
  xp: number;
  tier: number;
  color: string;
  glowColor: string;
  accentClass: string;
  icon: typeof Brain;
  blurb: string;
};

function project(x: number, y: number, originX: number, originY: number, scale: number) {
  return {
    x: originX + (x - y) * COS30 * scale,
    y: originY + (x + y) * SIN30 * scale,
  };
}

function buildZones(
  attributes: Record<AttributeKey, number>,
  level: number,
  streak: number = 0,
): Zone[] {
  const positions: Record<AttributeKey, [number, number]> = {
    MIND: [-1.4, -1.4],
    BODY: [1.4, -1.4],
    FOCUS: [-1.4, 1.4],
    CRAFT: [1.4, 1.4],
  };

  const zoneConfig: Record<
    AttributeKey,
    {
      name: string;
      color: string;
      glowColor: string;
      accentClass: string;
      icon: typeof Brain;
    }
  > = {
    MIND: {
      name: "The Great Library",
      color: "#22d3ee",
      glowColor: "color-mix(in oklab, var(--accent)_40%,transparent)",
      accentClass:
        "text-[var(--accent)] border-[color-mix(in_oklab,var(--accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]",
      icon: Brain,
    },
    FOCUS: {
      name: "The Sanctuary",
      color: "#c084fc",
      glowColor: "color-mix(in oklab, var(--arcane)_40%,transparent)",
      accentClass:
        "text-[var(--arcane)] border-[color-mix(in_oklab,var(--arcane)_50%,transparent)] bg-[color-mix(in_oklab,var(--arcane)_14%,transparent)]",
      icon: Zap,
    },
    BODY: {
      name: "Training Arena",
      color: "#34d399",
      glowColor: "color-mix(in oklab, var(--success)_40%,transparent)",
      accentClass:
        "text-[var(--success)] border-[color-mix(in_oklab,var(--success)_50%,transparent)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)]",
      icon: HeartPulse,
    },
    CRAFT: {
      name: "The Artisan Forge",
      color: "#fb923c",
      glowColor: "color-mix(in oklab, var(--ember)_40%,transparent)",
      accentClass:
        "text-[var(--primary)] border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-[color-mix(in_oklab,var(--primary)_14%,transparent)]",
      icon: Hammer,
    },
  };

  const zones: Zone[] = ATTRIBUTE_ORDER.map((key) => {
    const [gx, gy] = positions[key];
    const cfg = zoneConfig[key];
    return {
      key,
      label: key,
      name: cfg.name,
      gx,
      gy,
      xp: attributes[key],
      tier: tierForXp(attributes[key]),
      color: cfg.color,
      glowColor: cfg.glowColor,
      accentClass: cfg.accentClass,
      icon: cfg.icon,
      blurb: ATTRIBUTES[key].blurb,
    };
  });

  // Central Citadel representing Level & Overall Life Progress
  zones.push({
    key: "HOME",
    label: "CITADEL",
    name: "Citadel of Mastery",
    gx: 0,
    gy: 0,
    xp: level,
    tier: Math.min(4, Math.max(1, Math.ceil(level / 3))),
    color: "#facc15",
    glowColor: "rgba(250, 204, 21, 0.5)",
    accentClass: "text-primary border-primary/50 bg-primary/20",
    icon: Compass,
    blurb: `Central bastion of your personal sovereignty. Rises in stature with your character level. Active streak chain: ${streak} days.`,
  });

  return zones;
}

export function LifeWorldCanvas({
  attributes,
  level,
  streak = 0,
  height = 420,
}: {
  attributes: Record<AttributeKey, number>;
  level: number;
  streak?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [supported, setSupported] = useState(true);
  const [selected, setSelected] = useState<Zone | null>(null);
  const reduced = usePrefersReducedMotion();
  const zones = buildZones(attributes, level, streak);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setSupported(false);
      return;
    }

    let animationId: number;
    let tick = 0;

    // Ambient floating particles
    const particleCount = 28;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * 600,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.3 + 0.1,
      alpha: Math.random() * 0.5 + 0.2,
    }));

    const render = () => {
      tick += 0.02;
      const width = canvas.parentElement?.clientWidth ?? 800;
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const scale = Math.min(width / 7.2, height / 4.4);
      const originX = width / 2;
      const originY = height / 2 - scale * 0.3;

      // 1. Draw Starfield Particles
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < 0) p.y = height;
        ctx.beginPath();
        ctx.arc((p.x / 600) * width, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * (0.6 + 0.4 * Math.sin(tick + p.x))})`;
        ctx.fill();
      });

      // 2. Isometric Ground Cosmic Grid
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i += 1) {
        const a = project(i, -3, originX, originY, scale);
        const b = project(i, 3, originX, originY, scale);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle =
          i === 0
            ? "color-mix(in oklab, var(--primary)_20%,transparent)"
            : "rgba(255, 255, 255, 0.04)";
        ctx.stroke();

        const c = project(-3, i, originX, originY, scale);
        const d = project(3, i, originX, originY, scale);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.strokeStyle =
          i === 0
            ? "color-mix(in oklab, var(--primary)_20%,transparent)"
            : "rgba(255, 255, 255, 0.04)";
        ctx.stroke();
      }

      // 3. Energy Leylines connecting outer 4 zones to Central Citadel
      const center = project(0, 0, originX, originY, scale);
      zones
        .filter((z) => z.key !== "HOME")
        .forEach((z) => {
          const pt = project(z.gx, z.gy, originX, originY, scale);
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(center.x, center.y);
          ctx.strokeStyle = z.glowColor;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 6]);
          ctx.lineDashOffset = -tick * 10;
          ctx.stroke();
          ctx.setLineDash([]);
        });

      // 4. Streak Eternal Flame Ring around Citadel
      if (streak > 0) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, 18 + Math.sin(tick * 3) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = "color-mix(in oklab, var(--primary)_60%,transparent)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 5. Draw 2.5D Isometric Zone Structures (ordered far to near)
      const sortedZones = [...zones].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
      for (const zone of sortedZones) {
        drawIsometricMonument(ctx, zone, originX, originY, scale, tick);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [attributes, level, streak, height, reduced, zones]);

  return (
    <div className="relative rounded-2xl border border-border/60 bg-gradient-to-b from-card/80 via-card/40 to-background/90 p-4 sm:p-6 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* HUD Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/50 bg-primary/10 shadow-[0_0_15px_color-mix(in_oklab,var(--primary)_20%,transparent)]">
            <Compass className="h-4 w-4 text-primary animate-spin [animation-duration:30s]" />
          </div>
          <div>
            <h2 className="display text-base sm:text-lg font-bold uppercase tracking-wider text-foreground">
              Living Territory Map
            </h2>
            <p className="text-[11px] font-mono text-muted-foreground">
              Level {level} Realm · Real-time Isometric Projection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-3 py-1 text-xs font-mono text-[var(--primary)]">
              <Flame className="w-3.5 h-3.5 text-[var(--primary)] animate-pulse" />
              <span>{streak}-Day Flame Active</span>
            </div>
          )}
          <span className="hidden sm:inline text-xs font-mono text-muted-foreground uppercase">
            5 Sectors Aligned
          </span>
        </div>
      </div>

      {/* Main Visual World Canvas */}
      <div className="relative my-2">
        {reduced || !supported ? (
          <StaticWorldView zones={zones} height={height} />
        ) : (
          <canvas
            ref={canvasRef}
            aria-hidden
            className="block w-full cursor-crosshair"
            style={{ minHeight: `${height}px` }}
          />
        )}
      </div>

      {/* Interactive Zone Controller Dock */}
      <div className="border-t border-border/40 pt-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Inspect Sector
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {zones.map((zone) => {
            const Icon = zone.icon;
            const isSelected = selected?.key === zone.key;
            return (
              <button
                key={zone.key}
                type="button"
                onClick={() => setSelected(isSelected ? null : zone)}
                className={cn(
                  "group flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all duration-200",
                  isSelected
                    ? cn("border-border bg-secondary/60 shadow-lg scale-[1.02]", zone.accentClass)
                    : "border-border/40 bg-secondary/20 hover:border-border hover:bg-secondary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-mono font-bold uppercase tracking-wider"
                    style={{ color: zone.color }}
                  >
                    {zone.label}
                  </span>
                  <Icon className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                </div>
                <div className="mt-2 flex items-baseline justify-between text-xs font-mono">
                  <span className="text-foreground font-bold truncate">
                    {zone.key === "HOME" ? `Lvl ${zone.xp}` : `${zone.xp} XP`}
                  </span>
                  <span className="text-[10px] text-muted-foreground">T{zone.tier}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Sector Detail Overlay */}
      {selected && (
        <div className="mt-4 rounded-xl border border-border/80 bg-card/90 p-4 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border"
                style={{
                  borderColor: selected.color,
                  backgroundColor: `${selected.color}15`,
                  color: selected.color,
                }}
              >
                {(() => {
                  const Icon = selected.icon;
                  return <Icon className="w-5 h-5" />;
                })()}
              </div>
              <div>
                <h3 className="display text-base font-bold uppercase text-foreground">
                  {selected.name}
                </h3>
                <p className="text-xs font-mono" style={{ color: selected.color }}>
                  Sector {selected.label} · Tier {selected.tier} of 4 · {selected.xp} Total XP
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="Close inspect"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{selected.blurb}</p>
        </div>
      )}
    </div>
  );
}

function drawIsometricMonument(
  ctx: CanvasRenderingContext2D,
  zone: Zone,
  originX: number,
  originY: number,
  scale: number,
  tick: number,
) {
  const isHome = zone.key === "HOME";
  const heightPx = (0.45 + zone.tier * 0.35) * scale;
  const radius = isHome ? 0.75 : 0.6;

  const corners = [
    project(zone.gx - radius, zone.gy - radius, originX, originY, scale),
    project(zone.gx + radius, zone.gy - radius, originX, originY, scale),
    project(zone.gx + radius, zone.gy + radius, originX, originY, scale),
    project(zone.gx - radius, zone.gy + radius, originX, originY, scale),
  ];

  const top = corners.map((c) => ({ x: c.x, y: c.y - heightPx }));

  // Ground Plot Footprint Glow
  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y);
  ctx.closePath();
  ctx.fillStyle = zone.glowColor;
  ctx.fill();

  ctx.strokeStyle = zone.color;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left Wall Face
  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  ctx.lineTo(top[0]!.x, top[0]!.y);
  ctx.lineTo(top[1]!.x, top[1]!.y);
  ctx.lineTo(corners[1]!.x, corners[1]!.y);
  ctx.closePath();
  ctx.fillStyle = "rgba(18, 22, 34, 0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Right Wall Face
  ctx.beginPath();
  ctx.moveTo(corners[1]!.x, corners[1]!.y);
  ctx.lineTo(top[1]!.x, top[1]!.y);
  ctx.lineTo(top[2]!.x, top[2]!.y);
  ctx.lineTo(corners[2]!.x, corners[2]!.y);
  ctx.closePath();
  ctx.fillStyle = "rgba(26, 32, 48, 0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.stroke();

  // Roof Platform
  ctx.beginPath();
  ctx.moveTo(top[0]!.x, top[0]!.y);
  for (const corner of top.slice(1)) ctx.lineTo(corner.x, corner.y);
  ctx.closePath();
  ctx.fillStyle = isHome
    ? "color-mix(in oklab, var(--primary)_25%,transparent)"
    : "rgba(35, 43, 65, 0.98)";
  ctx.fill();
  ctx.strokeStyle = zone.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Central Vertical Beacon Spire on Citadel or High Tier Zone
  const centerTop = {
    x: (top[0]!.x + top[2]!.x) / 2,
    y: (top[0]!.y + top[2]!.y) / 2,
  };

  if (isHome) {
    // Citadel Spire & Sky Beam
    ctx.beginPath();
    ctx.moveTo(centerTop.x, centerTop.y);
    ctx.lineTo(centerTop.x, centerTop.y - scale * 0.9);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Floating Halo Light
    ctx.beginPath();
    ctx.arc(centerTop.x, centerTop.y - scale * 0.95, 5 + Math.sin(tick * 2) * 2, 0, Math.PI * 2);
    ctx.fillStyle = "#facc15";
    ctx.fill();
  } else {
    // Monument Spire
    const spireH = (0.2 + zone.tier * 0.15) * scale;
    ctx.beginPath();
    ctx.moveTo(centerTop.x, centerTop.y);
    ctx.lineTo(centerTop.x, centerTop.y - spireH);
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Pulsing Crystal Tip
    ctx.beginPath();
    ctx.arc(centerTop.x, centerTop.y - spireH, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = zone.color;
    ctx.fill();
  }
}

/** Static SVG backup for reduced motion or non-canvas platforms */
function StaticWorldView({ zones, height }: { zones: Zone[]; height: number }) {
  const originX = 300;
  const originY = height / 2 - 20;
  const scale = 48;

  return (
    <svg
      viewBox={`0 0 600 ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="World Zones Map"
      className="block"
    >
      {zones.map((zone) => {
        const corners = [
          project(zone.gx - 0.6, zone.gy - 0.6, originX, originY, scale),
          project(zone.gx + 0.6, zone.gy - 0.6, originX, originY, scale),
          project(zone.gx + 0.6, zone.gy + 0.6, originX, originY, scale),
          project(zone.gx - 0.6, zone.gy + 0.6, originX, originY, scale),
        ];
        const h = (0.35 + zone.tier * 0.3) * scale;
        const roof = corners.map((c) => `${c.x.toFixed(1)},${(c.y - h).toFixed(1)}`).join(" ");
        const plot = corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
        return (
          <g key={zone.key}>
            <polygon points={plot} fill={zone.glowColor} stroke={zone.color} strokeWidth="1" />
            <polygon
              points={roof}
              fill="rgba(35, 43, 65, 0.9)"
              stroke={zone.color}
              strokeWidth="1.5"
            />
          </g>
        );
      })}
    </svg>
  );
}
