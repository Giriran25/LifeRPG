# Life RPG

**Your real life is the quest.** A full-stack RPG productivity app: your own routines become quests, completing them pays XP and levels four attributes, and a 2.5D world grows as you do. When a quest starts to slip, the app rescopes it instead of letting you fail it.

Built on TanStack Start + React 19 + Supabase (Postgres with row-level security).

---

## Running it

```sh
npm install
cp .env.example .env     # fill in your Supabase project values
npm run dev
```

```sh
npm run lint             # eslint + prettier
npm test                 # vitest — engine invariants
npm run build            # production build
```

### Database

Migrations live in `drizzle/migrations/` and are applied **in order**:

| File                        | What it does                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `0000_life_rpg_core.sql`    | Base schema: profiles, quests, completions, daily activity, achievements, items, RLS, core RPCs     |
| `0001_strip_social.sql`     | Removes the community / leaderboard / AI-coach layer, the pay-to-win XP boost and the loot box      |
| `0002_life_rpg_product.sql` | Reward locking, attributes, deadlines, activities, rescope suggestions, the extended completion RPC |

Run them against your Supabase project (SQL editor, or `drizzle-kit` with `LOVABLE_DB_MIGRATION_URL` set). `drizzle/schema.ts` is intentionally blank and auto-generated — **do not** run `drizzle-kit push`; write a new numbered migration instead.

---

## How it works

### Everything that pays is server-authoritative

No XP, gold, level, streak, attribute or inventory value is ever computed by the browser and sent up. Every one of those writes goes through a `security definer` RPC in Postgres:

- `complete_quest(p_quest_id, p_actual_duration_min)` — awards rewards, advances the streak in the user's own timezone, credits the attribute, rolls a rescoped parent up when its last child lands
- `accept_rescope(p_suggestion_id, p_plan)` — the only path that may create reward-carrying quests
- `purchase_item`, `complete_onboarding`, `dismiss_rescope`

Row-level security is `auth.uid() = user_id` on every user table. `src/lib/player.functions.ts` is the only boundary the client talks through.

**Read-side scoring runs on the client on purpose.** `questRecommender` and `assessQuestRisk` award nothing — they only decide what to show — so running them locally costs a round trip and risks nothing.

### The differentiator: adaptive rescoping

A quest that is too big, too stale, or postponed too many times gets scored:

```
risk = 0.35·timePressure + 0.20·sizeMismatch + 0.15·staleness
     + 0.20·postponement + 0.10·workload
```

Above 0.55 the engine picks **one** intervention — SPLIT, SHRINK, RESCHEDULE or EXTEND — and below it says nothing at all. Silence is a valid output.

**The invariant that makes this honest: rescoping never changes what a quest is worth.** A 100 XP quest split into four stages produces stages worth 22/30/28/20 XP — summing to exactly 100. This is enforced three times over:

1. `allocate()` in `src/engine/rescopeEngine.ts` puts the rounding remainder on the last stage, so the sum is exact by construction
2. `src/engine/__tests__/rescopeEngine.test.ts` asserts it for 90/180/240-minute parents and every difficulty tier
3. `public.accept_rescope()` re-checks the sums in SQL and **raises an exception** rather than insert children that would mint or destroy XP

The trigger that made this hard is `public.quest_rewards()`, which stamps `xp_reward` from `difficulty` on every insert — it would silently overwrite a child's 22 XP with a flat 50. Children are therefore inserted with `rewards_locked = true`, and the trigger returns early for those rows.

Suggestions are rate limited: one per quest per 24h, three per user per day, and nothing for 72h after three consecutive dismissals. The engine enforces this and `saveRescopeSuggestion` enforces it again server-side.

### The recommender

```
score = 0.30·urgency + 0.25·durationFit + 0.20·timeOfDayFit
      + 0.15·attributeNeed + 0.10·affinity − 0.30·overload
```

`durationFit` compares the estimate against the median of your last 20 measured sessions (falling back to 45 minutes below five completions). "WHY THIS QUEST?" on the dashboard shows every weighted term and the one sentence generated from whichever term actually decided it — the bars are the real numbers, not decoration.

### Feeling local while being server-backed

Completion is optimistic: `src/lib/game.ts` mirrors the SQL XP curve (`25·(l−1)·l`) so XP, coins and level update on tap, with a full rollback on failure. **The celebration is not optimistic** — the level-up overlay and seal reveal play only on the server's response, so nothing is ever celebrated falsely.

### Attributes and the world

Eight activities map to four attributes — `SLEEP/WALKING/GYM → BODY`, `CODING → MIND`, `MEDITATION/SAVING/CLEAN_ROOM → FOCUS`, `JOBS → CRAFT`. Attribute XP drives zone tiers at `[0, 200, 600, 1500]` in the Life World: LIBRARY, TRAINING GROUND, SANCTUARY, WORKSHOP, and HOME at the centre driven by level.

The world is a plain 2D canvas using an isometric projection (`x' = (x−y)·cos30`, `y' = (x+y)·sin30`) — no WebGL, no 3D library. Under `prefers-reduced-motion`, or if canvas is unavailable, the same scene renders as static SVG and the zones remain reachable as real buttons.

### Onboarding: one registry, one renderer

Six steps, one `useReducer`, and a **single** `completeOnboarding` call at the end — nothing is written incrementally.

Three activities (**Coding, Walking, Meditation**) carry bespoke questions and produce quests interpolating your own numbers ("Walk 8,000 steps"). The other five (Sleep, Jobs, Saving, Clean Room, Gym) share two generic questions and a generic template.

**Both kinds live in the same registry** (`src/engine/activitySchemas.ts`) and are drawn by the same `QuestionRenderer` against one discriminated union (`number | chips | timeOfDay | singleChoice | multiChoice | text | date | currency`). Giving a shallow activity the full treatment is a data change in that one file — no new screen, no new component, no branch in the renderer.

Onboarding always produces **exactly three** quests, all medium difficulty, so the dashboard is never empty and never crowded.

### Design: "The Chronicle"

Light-first on parchment. Three system font families and no webfonts at all. Depth is a 1px ash hairline plus a hard 2px offset shadow — never a blur. The signature device is scale contrast: an 11px uppercase mono label sitting directly against a 56px serif word, with nothing in between.

The 39 Radix/shadcn primitives in `src/components/ui/` are kept underneath and reskinned entirely through CSS variables, so the accessibility work in them comes along for free.

---

## Ethics

- **No loot boxes.** The mystery chest and its random payout are deleted from the schema.
- **No pay-to-win.** The 2× XP boost is deleted; `player_effects.xp_boost_quests_left` is dropped.
- **No real money.** Four fixed-price items, bought with coins you earned.
- **Non-punitive streaks.** A Chain Ward repairs one missed day. The copy never says "you broke your streak".
- **An anomaly guard, not an accusation.** A quest reported as finished in under a tenth of its estimate still pays — at the easy rate — and leaves a row in `security_flags`.

## Accessibility

Semantic landmarks and exactly one `<h1>` per route. Every interactive element is a real `<button>` or `<a>` with a visible `:focus-visible` ring. XP and level-up go out through a single `aria-live="polite"` region. Progress bars carry `role="progressbar"` with `aria-valuetext` ("Level 8, 720 of 1000 XP"). Every heatmap cell is an individually labelled button, and cell density is shown with dot counts so colour is never the only signal. `prefers-reduced-motion` removes particles, staggers and canvas drift while leaving every function intact.

---

## Documented deviations from the spec

- **Login is by email only.** Usernames are collected at signup, stored uniquely, checked live for availability via an enumeration-safe `username_available()` RPC, and shown on the profile — but the `email_for_username()` login path and its timing-equalisation handling were cut for time. The login form still shows exactly one generic message for every failure ("Those credentials don't match a character.") so it is not an enumeration oracle.
- **Rescoping ships the full engine but only one full UI.** All four interventions score, persist and apply through `accept_rescope`. Only SPLIT gets the numbered plan with the per-stage editor; SHRINK, RESCHEDULE and EXTEND render as one-line proposals with accept/dismiss.
- **The XP curve is unchanged** from the foundation (`25·(l−1)·l`). Per-level cost is `50·l` — 50, 100, 150, 200 — which is non-linear as required, and it means the first medium quest you complete takes you to level 2.
- **`deadline_external` quests are never rescoped**, per spec. Worth revisiting: a hard external deadline is arguably when splitting helps most.
