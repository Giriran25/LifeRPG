import { MetaLabel } from "./MetaLabel";
import type { ActivityQuestion } from "@/engine/activitySchemas";
import { cn } from "@/lib/utils";

/**
 * One renderer for every activity question, deep or shallow.
 */
export function QuestionRenderer({
  question,
  value,
  onChange,
}: {
  question: ActivityQuestion;
  value: string | number | string[] | undefined;
  onChange: (value: string | number | string[]) => void;
}) {
  const id = `q-${question.id}`;

  return (
    <div className="border-b border-border/40 py-5 last:border-b-0">
      <label htmlFor={id} className="display block text-base font-semibold text-foreground">
        {question.label}
        {question.optional ? (
          <span className="text-xs font-mono text-muted-foreground/70 ml-2 tracking-wide uppercase">
            [ Optional ]
          </span>
        ) : null}
      </label>

      <div className="mt-3">
        {question.kind === "number" ? (
          <div className="flex items-baseline gap-3">
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={question.min}
              max={question.max}
              step={question.step ?? 1}
              value={typeof value === "number" ? value : question.default}
              onChange={(event) => onChange(Number(event.target.value))}
              className="w-36 rounded-xl border border-border/80 bg-secondary/20 px-4 py-2.5 display text-2xl text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {question.unit ? (
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {question.unit}
              </span>
            ) : null}
          </div>
        ) : null}

        {question.kind === "chips" ? (
          <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2.5">
            {question.options.map((option) => {
              const active = (typeof value === "number" ? value : question.default) === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(option)}
                  className={cn(
                    "rounded-xl border px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-all duration-200",
                    active
                      ? "border-primary bg-primary/20 text-primary shadow-[0_0_15px_color-mix(in_oklab,var(--primary)_25%,transparent)] font-bold scale-[1.02]"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {option}
                  {question.unit ? ` ${question.unit}` : ""}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.kind === "singleChoice" ? (
          <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2.5">
            {question.options.map((option) => {
              const active =
                (typeof value === "string" ? value : question.default) === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(option.value)}
                  className={cn(
                    "rounded-xl border px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-all duration-200",
                    active
                      ? "border-primary bg-primary/20 text-primary shadow-[0_0_15px_color-mix(in_oklab,var(--primary)_25%,transparent)] font-bold scale-[1.02]"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.kind === "multiChoice" ? (
          <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2.5">
            {question.options.map((option) => {
              const current = Array.isArray(value) ? value : question.default;
              const active = current.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange(
                      active
                        ? current.filter((v) => v !== option.value)
                        : [...current, option.value],
                    )
                  }
                  className={cn(
                    "rounded-xl border px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-all duration-200",
                    active
                      ? "border-primary bg-primary/20 text-primary shadow-[0_0_15px_color-mix(in_oklab,var(--primary)_25%,transparent)] font-bold"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.kind === "timeOfDay" ? (
          <input
            id={id}
            type="time"
            value={typeof value === "string" ? value : question.default}
            onChange={(event) => onChange(event.target.value)}
            className="rounded-xl border border-border/80 bg-secondary/20 px-4 py-2.5 display text-lg text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
          />
        ) : null}

        {question.kind === "date" ? (
          <input
            id={id}
            type="date"
            value={typeof value === "string" ? value : question.default}
            onChange={(event) => onChange(event.target.value)}
            className="rounded-xl border border-border/80 bg-secondary/20 px-4 py-2.5 text-xs font-mono uppercase text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
          />
        ) : null}

        {question.kind === "text" ? (
          <input
            id={id}
            type="text"
            value={typeof value === "string" ? value : question.default}
            placeholder={question.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-xl border border-border/80 bg-secondary/20 px-4 py-2.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
          />
        ) : null}

        {question.kind === "currency" ? (
          <div className="flex items-baseline gap-2">
            <span className="display text-2xl text-primary">{question.symbol}</span>
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={question.min}
              max={question.max}
              value={typeof value === "number" ? value : question.default}
              onChange={(event) => onChange(Number(event.target.value))}
              className="w-40 rounded-xl border border-border/80 bg-secondary/20 px-4 py-2.5 display text-2xl text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
