-- ============================================================================
-- 0002_life_rpg_product.sql
-- Life RPG product layer: reward locking, attributes, deadlines, activities,
-- rescope suggestions, and the extended completion RPC.
--
-- NOTE: the XP curve (public.xp_for_level / public.level_for_xp) is deliberately
-- UNCHANGED. 25*(l-1)*l gives a per-level cost of 50*l, which is non-linear and
-- already mirrored in src/lib/game.ts.
-- ============================================================================

-- ============================================================================
-- 1. REWARD LOCKING  (the critical fix)
--    public.quest_rewards() stamps xp_reward/gold_reward from difficulty on
--    every insert. Rescoped child quests must carry arbitrary values that sum
--    exactly to the parent's, so they opt out via rewards_locked.
-- ============================================================================
alter table public.quests add column if not exists rewards_locked boolean not null default false;

create or replace function public.quest_rewards()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.rewards_locked then return new; end if;
  new.xp_reward := case new.difficulty when 'easy' then 25 when 'medium' then 50 when 'hard' then 100 else 250 end;
  new.gold_reward := case new.difficulty when 'easy' then 5 when 'medium' then 10 when 'hard' then 20 else 50 end;
  return new;
end $$;

-- ============================================================================
-- 2. PROFILE COLUMNS
-- ============================================================================
alter table public.profiles
  add column if not exists username text unique,
  add column if not exists full_name text,
  add column if not exists main_goal text,
  add column if not exists focus_xp integer not null default 0,
  add column if not exists body_xp  integer not null default 0,
  add column if not exists mind_xp  integer not null default 0,
  add column if not exists craft_xp integer not null default 0,
  add column if not exists reward_prefs text[] not null default '{}',
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists reduced_motion boolean not null default false;

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- Username availability check needs to see taken names without exposing rows.
create or replace function public.username_available(p_username text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Carry full_name / username through from signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name',
             split_part(new.email, '@', 1), 'Adventurer'),
    new.raw_user_meta_data->>'full_name',
    nullif(trim(new.raw_user_meta_data->>'username'), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ============================================================================
-- 3. QUEST COLUMNS
--    quest_date is a DATE and cannot express a deadline; due_at carries the
--    time component the rescope engine scores time pressure from.
-- ============================================================================
alter table public.quests
  add column if not exists description text,
  add column if not exists activity_key text,
  add column if not exists attribute text,
  add column if not exists est_duration_min integer not null default 30,
  add column if not exists due_at timestamptz,
  add column if not exists deadline_external boolean not null default false,
  add column if not exists times_postponed integer not null default 0,
  add column if not exists actual_duration_min integer,
  add column if not exists parent_quest_id uuid references public.quests(id) on delete cascade;

do $$ begin
  alter table public.quests add constraint quests_attribute_chk
    check (attribute is null or attribute in ('FOCUS','BODY','MIND','CRAFT'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.quests add constraint quests_est_duration_chk
    check (est_duration_min between 5 and 480);
exception when duplicate_object then null; end $$;

create index if not exists quests_parent_idx on public.quests(parent_quest_id);
create index if not exists quests_user_due_idx on public.quests(user_id, due_at);

-- Keep quest_date derived from due_at so the existing indexes and the
-- daily_activity joins keep working unchanged.
create or replace function public.quest_sync_date()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.due_at is not null then
    new.quest_date := (new.due_at at time zone coalesce(
      (select timezone from public.profiles where id = new.user_id), 'UTC'))::date;
  end if;
  return new;
end $$;

drop trigger if exists quests_sync_date_biu on public.quests;
create trigger quests_sync_date_biu before insert or update of due_at on public.quests
  for each row execute function public.quest_sync_date();

-- ============================================================================
-- 4. USER ACTIVITIES
-- ============================================================================
create table if not exists public.user_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_key text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, activity_key)
);
create index if not exists user_activities_user_idx on public.user_activities(user_id);
grant select, insert, update, delete on public.user_activities to authenticated;
grant all on public.user_activities to service_role;
alter table public.user_activities enable row level security;
do $$ begin
  create policy "own activities" on public.user_activities for all to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 5. RESCOPE SUGGESTIONS
-- ============================================================================
create table if not exists public.rescope_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  risk_score numeric(4,3) not null,
  intervention text not null check (intervention in ('SPLIT','SHRINK','RESCHEDULE','EXTEND')),
  plan jsonb not null default '[]'::jsonb,
  rationale text not null,
  engine_version text not null default 'rescope-v1',
  outcome text not null default 'PENDING'
    check (outcome in ('PENDING','ACCEPTED','EDITED','DISMISSED','EXPIRED')),
  suggested_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists rescope_user_outcome_idx on public.rescope_suggestions(user_id, outcome);
create index if not exists rescope_quest_idx on public.rescope_suggestions(quest_id, suggested_at desc);
grant select, insert, update on public.rescope_suggestions to authenticated;
grant all on public.rescope_suggestions to service_role;
alter table public.rescope_suggestions enable row level security;
do $$ begin
  create policy "own rescope" on public.rescope_suggestions for all to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 6. SHOP: four honest items, no randomness
-- ============================================================================
insert into public.items (code,name,emoji,description,price_gold,rarity,effect,sort_order) values
 ('xp_potion','Ink Vial','🧪','Instantly gain +100 XP',200,'common','xp_100',1),
 ('streak_shield','Chain Ward','🛡️','Protects your chain for one missed day',300,'rare','streak_shield',2),
 ('quill_seal','Gilded Seal','🪶','A gold seal stamped on your chronicle',450,'rare','cosmetic',3),
 ('cartographer','Cartographer''s Mark','🗺️','A permanent mark on your world map',800,'epic','cosmetic',4)
on conflict (code) do update
  set name = excluded.name, emoji = excluded.emoji, description = excluded.description,
      price_gold = excluded.price_gold, rarity = excluded.rarity,
      effect = excluded.effect, sort_order = excluded.sort_order;

-- ============================================================================
-- 7. COMPLETE_QUEST  (extends the existing function, keeps every guard)
-- ============================================================================
drop function if exists public.complete_quest(uuid);
create or replace function public.complete_quest(
  p_quest_id uuid,
  p_actual_duration_min integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q public.quests;
  prof public.profiles;
  today date;
  prev_level integer;
  new_level integer;
  xp_award integer;
  gold_award integer;
  recent integer;
  unlocked jsonb;
  attr text;
  attr_total integer := 0;
  anomalous boolean := false;
  on_time boolean := true;
  parent_done boolean := false;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into q from public.quests where id = p_quest_id and user_id = uid for update;
  if q is null then raise exception 'Quest not found'; end if;
  if q.status = 'completed' then raise exception 'Quest already completed'; end if;

  -- rate limit (unchanged)
  select count(*) into recent from public.quest_completions
   where user_id = uid and completed_at > now() - interval '1 minute';
  if recent >= 20 then
    insert into public.security_flags (user_id, reason, details)
    values (uid, 'rapid_completions', jsonb_build_object('count', recent));
    raise exception 'Too many completions in a short time. Please slow down.';
  end if;

  today := public.user_today(uid);
  select * into prof from public.profiles where id = uid for update;
  prev_level := prof.level;

  xp_award := q.xp_reward;
  gold_award := q.gold_reward;

  -- anomaly guard: a quest "finished" in under a tenth of its estimate pays
  -- the easy rate and leaves a flag behind.
  if p_actual_duration_min is not null
     and p_actual_duration_min >= 0
     and p_actual_duration_min < 0.1 * q.est_duration_min then
    anomalous := true;
    xp_award := 25;
    gold_award := 5;
    insert into public.security_flags (user_id, reason, details)
    values (uid, 'implausible_duration', jsonb_build_object(
      'quest_id', q.id, 'reported_min', p_actual_duration_min, 'estimate_min', q.est_duration_min));
  end if;

  on_time := q.due_at is null or now() <= q.due_at;

  update public.quests
     set status = 'completed',
         completed_at = now(),
         actual_duration_min = coalesce(p_actual_duration_min, actual_duration_min)
   where id = q.id;

  insert into public.quest_completions (user_id, quest_id, day, xp_awarded, gold_awarded, category)
  values (uid, q.id, today, xp_award, gold_award, q.category);

  insert into public.daily_activity (user_id, day, quests_completed, xp_earned, gold_earned)
  values (uid, today, 1, xp_award, gold_award)
  on conflict (user_id, day) do update
    set quests_completed = public.daily_activity.quests_completed + 1,
        xp_earned = public.daily_activity.xp_earned + xp_award,
        gold_earned = public.daily_activity.gold_earned + gold_award;

  -- streak (server authoritative, user timezone, shield-protected)
  if prof.last_active_date is null then
    update public.profiles set current_streak = 1, longest_streak = greatest(longest_streak,1),
      last_active_date = today where id = uid;
  elsif prof.last_active_date = today then
    null;
  elsif prof.last_active_date = today - 1 then
    update public.profiles set current_streak = current_streak + 1,
      longest_streak = greatest(longest_streak, current_streak + 1), last_active_date = today where id = uid;
  else
    if coalesce((select streak_shields from public.player_effects where user_id = uid),0) > 0
       and prof.last_active_date = today - 2 then
      update public.player_effects set streak_shields = streak_shields - 1 where user_id = uid;
      update public.profiles set current_streak = current_streak + 1,
        longest_streak = greatest(longest_streak, current_streak + 1), last_active_date = today where id = uid;
    else
      update public.profiles set current_streak = 1, last_active_date = today where id = uid;
    end if;
  end if;

  update public.profiles set quests_completed = quests_completed + 1 where id = uid;

  -- attribute award
  attr := q.attribute;
  if attr = 'FOCUS' then
    update public.profiles set focus_xp = focus_xp + xp_award where id = uid returning focus_xp into attr_total;
  elsif attr = 'BODY' then
    update public.profiles set body_xp = body_xp + xp_award where id = uid returning body_xp into attr_total;
  elsif attr = 'MIND' then
    update public.profiles set mind_xp = mind_xp + xp_award where id = uid returning mind_xp into attr_total;
  elsif attr = 'CRAFT' then
    update public.profiles set craft_xp = craft_xp + xp_award where id = uid returning craft_xp into attr_total;
  end if;

  perform public.grant_rewards(uid, xp_award, gold_award, 'quest', q.title);

  if q.goal_id is not null then
    update public.goals set completed_quests = completed_quests + 1,
      completed_at = case when completed_quests + 1 >= target_quests then now() else completed_at end
     where id = q.goal_id and user_id = uid;
  end if;

  -- parent rollup: the tracker closes itself once every child is done, and
  -- pays nothing further because the children already paid in full.
  if q.parent_quest_id is not null then
    if not exists (
      select 1 from public.quests s
       where s.parent_quest_id = q.parent_quest_id and s.status <> 'completed'
    ) then
      update public.quests set status = 'completed', completed_at = now()
       where id = q.parent_quest_id and user_id = uid and status <> 'completed';
      parent_done := true;
    end if;
  end if;

  unlocked := public.check_achievements(uid);
  select * into prof from public.profiles where id = uid;
  new_level := prof.level;

  return jsonb_build_object(
    'xp_awarded', xp_award,
    'gold_awarded', gold_award,
    'leveled_up', new_level > prev_level,
    'previous_level', prev_level,
    'old_level', prev_level,
    'new_level', new_level,
    'unlocked', unlocked,
    'new_badges', unlocked,
    'attribute', attr,
    'attribute_total', attr_total,
    'streak', prof.current_streak,
    'on_time', on_time,
    'anomalous', anomalous,
    'parent_completed', parent_done,
    'profile', to_jsonb(prof)
  );
end $$;

-- ============================================================================
-- 8. RESCOPE RPCs
-- ============================================================================
-- accept_rescope: the only path that may create reward-carrying quests.
-- The XP/gold sums of the children must equal the parent's exactly.
create or replace function public.accept_rescope(
  p_suggestion_id uuid,
  p_plan jsonb default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.rescope_suggestions;
  parent public.quests;
  use_plan jsonb;
  step jsonb;
  sum_xp integer := 0;
  sum_gold integer := 0;
  n integer;
  idx integer := 0;
  child public.quests;
  created jsonb := '[]'::jsonb;
  child_due timestamptz;
  child_date date;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.rescope_suggestions
   where id = p_suggestion_id and user_id = uid for update;
  if s is null then raise exception 'Suggestion not found'; end if;
  if s.outcome <> 'PENDING' then raise exception 'Suggestion already resolved'; end if;

  select * into parent from public.quests where id = s.quest_id and user_id = uid for update;
  if parent is null then raise exception 'Quest not found'; end if;
  if parent.status = 'completed' then raise exception 'Quest already completed'; end if;

  use_plan := coalesce(p_plan, s.plan);
  n := jsonb_array_length(use_plan);
  if n is null or n < 1 then raise exception 'Rescope plan is empty'; end if;

  -- INVARIANT: rewards are preserved, never created.
  for step in select * from jsonb_array_elements(use_plan) loop
    sum_xp   := sum_xp   + coalesce((step->>'reward_xp')::int, 0);
    sum_gold := sum_gold + coalesce((step->>'reward_gold')::int, 0);
  end loop;

  if sum_xp <> parent.xp_reward then
    raise exception 'Rescope would change XP: children sum to % but the quest is worth %',
      sum_xp, parent.xp_reward;
  end if;
  if sum_gold <> parent.gold_reward then
    raise exception 'Rescope would change gold: children sum to % but the quest is worth %',
      sum_gold, parent.gold_reward;
  end if;

  for step in select * from jsonb_array_elements(use_plan) loop
    idx := idx + 1;
    child_due := nullif(step->>'due_at','')::timestamptz;
    if child_due is null then child_due := parent.due_at; end if;
    child_date := coalesce(
      (child_due at time zone coalesce((select timezone from public.profiles where id = uid),'UTC'))::date,
      parent.quest_date);

    insert into public.quests (
      user_id, title, description, category, difficulty, goal_id, quest_date,
      status, xp_reward, gold_reward, rewards_locked, source,
      activity_key, attribute, est_duration_min, due_at, deadline_external,
      parent_quest_id
    ) values (
      uid,
      coalesce(nullif(trim(step->>'title'),''), parent.title || ' — part ' || idx),
      nullif(step->>'description',''),
      parent.category,
      parent.difficulty,
      parent.goal_id,
      child_date,
      'pending',
      coalesce((step->>'reward_xp')::int, 0),
      coalesce((step->>'reward_gold')::int, 0),
      true,                                   -- rewards_locked: keep our numbers
      'rescope',
      parent.activity_key,
      parent.attribute,
      greatest(5, least(480, coalesce((step->>'est_duration_min')::int, parent.est_duration_min))),
      child_due,
      parent.deadline_external,
      parent.id
    ) returning * into child;

    created := created || to_jsonb(child);
  end loop;

  -- the parent stays a tracker, not something you complete directly
  update public.quests set status = 'pending' where id = parent.id;

  update public.rescope_suggestions
     set outcome = case when p_plan is null or p_plan = s.plan then 'ACCEPTED' else 'EDITED' end,
         plan = use_plan,
         responded_at = now()
   where id = s.id;

  return jsonb_build_object(
    'parent_id', parent.id,
    'children', created,
    'xp_preserved', sum_xp,
    'gold_preserved', sum_gold
  );
end $$;

create or replace function public.dismiss_rescope(p_suggestion_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); updated integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.rescope_suggestions
     set outcome = 'DISMISSED', responded_at = now()
   where id = p_suggestion_id and user_id = uid and outcome = 'PENDING';
  get diagnostics updated = row_count;
  if updated = 0 then raise exception 'Suggestion not found'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================================
-- 9. ONBOARDING  (one atomic write)
-- ============================================================================
create or replace function public.complete_onboarding(
  p_profile jsonb,
  p_activities jsonb,
  p_quests jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a jsonb;
  qs jsonb;
  today date;
  inserted jsonb := '[]'::jsonb;
  row_q public.quests;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  today := public.user_today(uid);

  update public.profiles set
    display_name = coalesce(nullif(trim(p_profile->>'display_name'),''), display_name),
    full_name    = coalesce(nullif(trim(p_profile->>'full_name'),''), full_name),
    username     = coalesce(nullif(trim(p_profile->>'username'),''), username),
    avatar_emoji = coalesce(nullif(p_profile->>'avatar_emoji',''), avatar_emoji),
    main_goal    = coalesce(nullif(p_profile->>'main_goal',''), main_goal),
    timezone     = coalesce(nullif(p_profile->>'timezone',''), timezone),
    reward_prefs = coalesce(
      (select array_agg(t.pref)
         from jsonb_array_elements_text(
           case when jsonb_typeof(p_profile->'reward_prefs') = 'array'
                then p_profile->'reward_prefs' else '[]'::jsonb end) as t(pref)),
      reward_prefs),
    onboarding_complete = true
  where id = uid;

  delete from public.user_activities where user_id = uid;
  for a in select * from jsonb_array_elements(coalesce(p_activities,'[]'::jsonb)) loop
    insert into public.user_activities (user_id, activity_key, config)
    values (uid, a->>'activity_key', coalesce(a->'config','{}'::jsonb))
    on conflict (user_id, activity_key) do update set config = excluded.config, enabled = true;
  end loop;

  for qs in select * from jsonb_array_elements(coalesce(p_quests,'[]'::jsonb)) loop
    insert into public.quests (
      user_id, title, description, category, difficulty, quest_date,
      activity_key, attribute, est_duration_min, due_at, source
    ) values (
      uid,
      qs->>'title',
      nullif(qs->>'description',''),
      coalesce(nullif(qs->>'category',''), 'General'),
      coalesce(nullif(qs->>'difficulty','')::public.quest_difficulty, 'medium'),
      today,
      nullif(qs->>'activity_key',''),
      nullif(qs->>'attribute',''),
      greatest(5, least(480, coalesce((qs->>'est_duration_min')::int, 30))),
      nullif(qs->>'due_at','')::timestamptz,
      'onboarding'
    ) returning * into row_q;
    inserted := inserted || to_jsonb(row_q);
  end loop;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'quests', inserted
  );
end $$;
