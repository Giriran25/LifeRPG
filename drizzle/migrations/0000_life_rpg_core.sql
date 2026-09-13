-- ============ ENUMS ============
create type public.quest_difficulty as enum ('easy','medium','hard','epic');
create type public.quest_status as enum ('pending','completed','skipped');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer',
  title text not null default 'Novice Adventurer',
  avatar_emoji text not null default '⚔️',
  timezone text not null default 'UTC',
  xp integer not null default 0,
  gold integer not null default 0,
  level integer not null default 1,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  quests_completed integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "public profiles read" on public.profiles for select to authenticated using (is_public);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Adventurer'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ GOALS ============
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  emoji text not null default '🎯',
  target_quests integer not null default 20,
  completed_quests integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index goals_user_idx on public.goals(user_id);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create policy "own goals" on public.goals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ QUESTS ============
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  difficulty public.quest_difficulty not null default 'medium',
  goal_id uuid references public.goals(id) on delete set null,
  quest_date date not null,
  status public.quest_status not null default 'pending',
  xp_reward integer not null default 50,
  gold_reward integer not null default 10,
  recovered_from uuid references public.quests(id) on delete set null,
  source text not null default 'manual',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index quests_user_date_idx on public.quests(user_id, quest_date desc);
create index quests_user_status_idx on public.quests(user_id, status);
grant select, insert, update, delete on public.quests to authenticated;
grant all on public.quests to service_role;
alter table public.quests enable row level security;
create policy "own quests" on public.quests for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.quest_rewards()
returns trigger language plpgsql set search_path = public as $$
begin
  new.xp_reward := case new.difficulty when 'easy' then 25 when 'medium' then 50 when 'hard' then 100 else 250 end;
  new.gold_reward := case new.difficulty when 'easy' then 5 when 'medium' then 10 when 'hard' then 20 else 50 end;
  return new;
end $$;
create trigger quests_rewards_biu before insert or update of difficulty on public.quests
  for each row execute function public.quest_rewards();

-- ============ COMPLETIONS / ACTIVITY ============
create table public.quest_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null unique references public.quests(id) on delete cascade,
  day date not null,
  xp_awarded integer not null,
  gold_awarded integer not null,
  category text not null default 'General',
  completed_at timestamptz not null default now()
);
create index qc_user_day_idx on public.quest_completions(user_id, day);
grant select on public.quest_completions to authenticated;
grant all on public.quest_completions to service_role;
alter table public.quest_completions enable row level security;
create policy "own completions" on public.quest_completions for select to authenticated using (auth.uid() = user_id);

create table public.daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  quests_completed integer not null default 0,
  xp_earned integer not null default 0,
  gold_earned integer not null default 0,
  primary key (user_id, day)
);
grant select on public.daily_activity to authenticated;
grant all on public.daily_activity to service_role;
alter table public.daily_activity enable row level security;
create policy "own activity" on public.daily_activity for select to authenticated using (auth.uid() = user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  xp_delta integer not null default 0,
  gold_delta integer not null default 0,
  description text not null default '',
  created_at timestamptz not null default now()
);
create index tx_user_idx on public.transactions(user_id, created_at desc);
grant select on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "own tx" on public.transactions for select to authenticated using (auth.uid() = user_id);

-- ============ ACHIEVEMENTS ============
create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  emoji text not null,
  category text not null,
  threshold integer not null default 0,
  gold_reward integer not null default 0,
  sort_order integer not null default 0
);
grant select on public.achievements to authenticated, anon;
grant all on public.achievements to service_role;
alter table public.achievements enable row level security;
create policy "achievements readable" on public.achievements for select to authenticated, anon using (true);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.achievements(code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);
grant select on public.user_achievements to authenticated;
grant all on public.user_achievements to service_role;
alter table public.user_achievements enable row level security;
create policy "own achievements" on public.user_achievements for select to authenticated using (auth.uid() = user_id);
create policy "public achievements" on public.user_achievements for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = user_id and p.is_public));

insert into public.achievements (code,name,description,emoji,category,threshold,gold_reward,sort_order) values
 ('first_quest','First Quest','Complete your very first quest','🏆','quests',1,50,1),
 ('quests_10','Getting Started','Complete 10 quests','⚔️','quests',10,100,2),
 ('quests_50','Quest Hunter','Complete 50 quests','🗡️','quests',50,250,3),
 ('quests_100','Quest Master','Complete 100 quests','👑','quests',100,500,4),
 ('quests_500','Legend','Complete 500 quests','🌠','quests',500,2000,5),
 ('streak_3','Spark','3 day streak','✨','streak',3,50,10),
 ('streak_7','7-Day Warrior','7 day streak','🔥','streak',7,150,11),
 ('streak_14','Fortnight Fighter','14 day streak','🔥','streak',14,300,12),
 ('streak_30','Disciplined Warrior','30 day streak','🛡️','streak',30,500,13),
 ('streak_60','Unbreakable','60 day streak','⚡','streak',60,1000,14),
 ('streak_100','Centurion','100 day streak','💎','streak',100,2500,15),
 ('xp_1000','Apprentice','Earn 1,000 XP','⭐','xp',1000,100,20),
 ('xp_5000','Adept','Earn 5,000 XP','🌟','xp',5000,300,21),
 ('xp_10000','Scholar','Earn 10,000 XP','🧠',  'xp',10000,600,22),
 ('xp_50000','Ascendant','Earn 50,000 XP','🌌','xp',50000,3000,23),
 ('level_10','Seasoned','Reach level 10','🎖️','level',10,200,30),
 ('level_25','Elite','Reach level 25','🏅','level',25,750,31),
 ('level_50','Grandmaster','Reach level 50','👑','level',50,2500,32),
 ('community_creator','Community Creator','Shared your Life RPG journey','📣','social',0,150,40),
 ('social_butterfly','Guild Member','Join your first community','🤝','social',0,100,41);

-- ============ ITEMS / INVENTORY ============
create table public.items (
  code text primary key,
  name text not null,
  emoji text not null,
  description text not null,
  price_gold integer not null,
  rarity text not null default 'common',
  effect text not null,
  sort_order integer not null default 0
);
grant select on public.items to authenticated, anon;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "items readable" on public.items for select to authenticated, anon using (true);

insert into public.items (code,name,emoji,description,price_gold,rarity,effect,sort_order) values
 ('xp_potion','XP Potion','🧪','Instantly gain +100 XP',200,'common','xp_100',1),
 ('streak_shield','Streak Shield','🛡️','Protects your streak for one missed day',300,'rare','streak_shield',2),
 ('xp_boost','XP Boost','⚡','Double XP for your next 3 quests',500,'epic','xp_boost',3),
 ('mystery_chest','Mystery Chest','🎁','Contains a random reward',750,'legendary','mystery',4);

create table public.inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_code text not null references public.items(code) on delete cascade,
  quantity integer not null default 0,
  primary key (user_id, item_code)
);
grant select on public.inventory to authenticated;
grant all on public.inventory to service_role;
alter table public.inventory enable row level security;
create policy "own inventory" on public.inventory for select to authenticated using (auth.uid() = user_id);

create table public.player_effects (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp_boost_quests_left integer not null default 0,
  streak_shields integer not null default 0
);
grant select on public.player_effects to authenticated;
grant all on public.player_effects to service_role;
alter table public.player_effects enable row level security;
create policy "own effects" on public.player_effects for select to authenticated using (auth.uid() = user_id);

-- ============ COMMUNITIES ============
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  emoji text not null default '🛡️',
  description text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  member_count integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert on public.communities to authenticated;
grant all on public.communities to service_role;
alter table public.communities enable row level security;
create policy "communities readable" on public.communities for select to authenticated using (true);
create policy "communities insert" on public.communities for insert to authenticated with check (auth.uid() = created_by);

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
grant select, insert, delete on public.community_members to authenticated;
grant all on public.community_members to service_role;
alter table public.community_members enable row level security;
create policy "members readable" on public.community_members for select to authenticated using (true);
create policy "join self" on public.community_members for insert to authenticated with check (auth.uid() = user_id);
create policy "leave self" on public.community_members for delete to authenticated using (auth.uid() = user_id);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'update',
  body text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index posts_community_idx on public.community_posts(community_id, created_at desc);
grant select, insert, delete on public.community_posts to authenticated;
grant all on public.community_posts to service_role;
alter table public.community_posts enable row level security;
create policy "posts readable to members" on public.community_posts for select to authenticated using (true);
create policy "post as member" on public.community_posts for insert to authenticated
  with check (auth.uid() = user_id and exists (
    select 1 from public.community_members m where m.community_id = community_id and m.user_id = auth.uid()));
create policy "delete own post" on public.community_posts for delete to authenticated using (auth.uid() = user_id);

create table public.post_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
grant select, insert, delete on public.post_reactions to authenticated;
grant all on public.post_reactions to service_role;
alter table public.post_reactions enable row level security;
create policy "reactions readable" on public.post_reactions for select to authenticated using (true);
create policy "react self" on public.post_reactions for insert to authenticated with check (auth.uid() = user_id);
create policy "unreact self" on public.post_reactions for delete to authenticated using (auth.uid() = user_id);

create table public.community_challenges (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  description text not null default '',
  required_quests integer not null default 20,
  xp_reward integer not null default 1000,
  badge_code text references public.achievements(code) on delete set null,
  starts_on date not null default current_date,
  ends_on date not null default (current_date + 30),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert on public.community_challenges to authenticated;
grant all on public.community_challenges to service_role;
alter table public.community_challenges enable row level security;
create policy "challenges readable" on public.community_challenges for select to authenticated using (true);
create policy "challenge create as member" on public.community_challenges for insert to authenticated
  with check (auth.uid() = created_by and exists (
    select 1 from public.community_members m where m.community_id = community_id and m.user_id = auth.uid()));

create table public.challenge_participants (
  challenge_id uuid not null references public.community_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progress integer not null default 0,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (challenge_id, user_id)
);
grant select, insert on public.challenge_participants to authenticated;
grant all on public.challenge_participants to service_role;
alter table public.challenge_participants enable row level security;
create policy "participants readable" on public.challenge_participants for select to authenticated using (true);
create policy "join challenge self" on public.challenge_participants for insert to authenticated with check (auth.uid() = user_id);

-- ============ AI + SHARES ============
create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
grant select on public.ai_recommendations to authenticated;
grant all on public.ai_recommendations to service_role;
alter table public.ai_recommendations enable row level security;
create policy "own recs" on public.ai_recommendations for select to authenticated using (auth.uid() = user_id);

create table public.social_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  platform text not null default 'unknown',
  verification text not null default 'user_confirmed',
  created_at timestamptz not null default now()
);
grant select on public.social_shares to authenticated;
grant all on public.social_shares to service_role;
alter table public.social_shares enable row level security;
create policy "own shares" on public.social_shares for select to authenticated using (auth.uid() = user_id);

create table public.security_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant all on public.security_flags to service_role;
alter table public.security_flags enable row level security;

-- ============ CORE GAME FUNCTIONS ============
create or replace function public.level_for_xp(p_xp integer)
returns integer language sql immutable set search_path = public as $$
  select greatest(1, floor((1 + sqrt(1 + (4.0 * greatest(p_xp,0) / 25.0))) / 2)::int)
$$;

create or replace function public.xp_for_level(p_level integer)
returns integer language sql immutable set search_path = public as $$
  select (25 * (greatest(p_level,1) - 1) * greatest(p_level,1))::int
$$;

create or replace function public.title_for_level(p_level integer)
returns text language sql immutable set search_path = public as $$
  select case
    when p_level >= 50 then 'Mythic Grandmaster'
    when p_level >= 40 then 'Ascendant'
    when p_level >= 30 then 'Champion'
    when p_level >= 25 then 'Elite Adventurer'
    when p_level >= 18 then 'Veteran Adventurer'
    when p_level >= 12 then 'Seasoned Adventurer'
    when p_level >= 6 then 'Journeyman'
    when p_level >= 3 then 'Apprentice'
    else 'Novice Adventurer' end
$$;

create or replace function public.user_today(p_user uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = p_user), 'UTC'))::date
$$;

-- grants rewards, records tx, unlocks achievements. internal use only.
create or replace function public.grant_rewards(p_user uuid, p_xp integer, p_gold integer, p_kind text, p_desc text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set xp = xp + greatest(p_xp,0),
         gold = gold + greatest(p_gold,0),
         level = public.level_for_xp(xp + greatest(p_xp,0)),
         title = public.title_for_level(public.level_for_xp(xp + greatest(p_xp,0)))
   where id = p_user;
  insert into public.transactions (user_id, kind, xp_delta, gold_delta, description)
  values (p_user, p_kind, greatest(p_xp,0), greatest(p_gold,0), p_desc);
end $$;

create or replace function public.check_achievements(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  prof public.profiles;
  a public.achievements;
  unlocked jsonb := '[]'::jsonb;
begin
  select * into prof from public.profiles where id = p_user;
  if prof is null then return unlocked; end if;
  for a in
    select * from public.achievements
    where code not in (select code from public.user_achievements where user_id = p_user)
      and ((category = 'quests' and prof.quests_completed >= threshold)
        or (category = 'streak' and prof.current_streak >= threshold)
        or (category = 'xp' and prof.xp >= threshold)
        or (category = 'level' and prof.level >= threshold))
    order by sort_order
  loop
    insert into public.user_achievements (user_id, code) values (p_user, a.code) on conflict do nothing;
    if a.gold_reward > 0 then
      update public.profiles set gold = gold + a.gold_reward where id = p_user;
      insert into public.transactions (user_id, kind, gold_delta, description)
      values (p_user, 'achievement', a.gold_reward, a.name);
    end if;
    unlocked := unlocked || jsonb_build_object('code', a.code, 'name', a.name, 'emoji', a.emoji,
      'description', a.description, 'gold_reward', a.gold_reward);
  end loop;
  return unlocked;
end $$;

create or replace function public.complete_quest(p_quest_id uuid)
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
  boost integer := 0;
  recent integer;
  unlocked jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into q from public.quests where id = p_quest_id and user_id = uid for update;
  if q is null then raise exception 'Quest not found'; end if;
  if q.status = 'completed' then raise exception 'Quest already completed'; end if;

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

  select coalesce(xp_boost_quests_left,0) into boost from public.player_effects where user_id = uid;
  xp_award := q.xp_reward * (case when coalesce(boost,0) > 0 then 2 else 1 end);
  gold_award := q.gold_reward;
  if coalesce(boost,0) > 0 then
    update public.player_effects set xp_boost_quests_left = xp_boost_quests_left - 1 where user_id = uid;
  end if;

  update public.quests set status = 'completed', completed_at = now() where id = q.id;
  insert into public.quest_completions (user_id, quest_id, day, xp_awarded, gold_awarded, category)
  values (uid, q.id, today, xp_award, gold_award, q.category);

  insert into public.daily_activity (user_id, day, quests_completed, xp_earned, gold_earned)
  values (uid, today, 1, xp_award, gold_award)
  on conflict (user_id, day) do update
    set quests_completed = public.daily_activity.quests_completed + 1,
        xp_earned = public.daily_activity.xp_earned + xp_award,
        gold_earned = public.daily_activity.gold_earned + gold_award;

  -- streak (server authoritative, user timezone)
  if prof.last_active_date is null then
    update public.profiles set current_streak = 1, longest_streak = greatest(longest_streak,1), last_active_date = today where id = uid;
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
  perform public.grant_rewards(uid, xp_award, gold_award, 'quest', q.title);

  if q.goal_id is not null then
    update public.goals set completed_quests = completed_quests + 1,
      completed_at = case when completed_quests + 1 >= target_quests then now() else completed_at end
     where id = q.goal_id and user_id = uid;
  end if;

  update public.challenge_participants cp set progress = cp.progress + 1,
    completed_at = case when cp.progress + 1 >= c.required_quests and cp.completed_at is null then now() else cp.completed_at end
   from public.community_challenges c
   where cp.challenge_id = c.id and cp.user_id = uid
     and today between c.starts_on and c.ends_on;

  unlocked := public.check_achievements(uid);
  select * into prof from public.profiles where id = uid;
  new_level := prof.level;

  return jsonb_build_object(
    'xp_awarded', xp_award, 'gold_awarded', gold_award,
    'leveled_up', new_level > prev_level, 'previous_level', prev_level, 'new_level', new_level,
    'unlocked', unlocked,
    'profile', to_jsonb(prof)
  );
end $$;

create or replace function public.purchase_item(p_item_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); it public.items; prof public.profiles;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into it from public.items where code = p_item_code;
  if it is null then raise exception 'Item not found'; end if;
  select * into prof from public.profiles where id = uid for update;
  if prof.gold < it.price_gold then raise exception 'Not enough gold'; end if;
  update public.profiles set gold = gold - it.price_gold where id = uid;
  insert into public.inventory (user_id, item_code, quantity) values (uid, it.code, 1)
    on conflict (user_id, item_code) do update set quantity = public.inventory.quantity + 1;
  insert into public.transactions (user_id, kind, gold_delta, description)
  values (uid, 'purchase', -it.price_gold, it.name);
  select * into prof from public.profiles where id = uid;
  return jsonb_build_object('profile', to_jsonb(prof), 'item', to_jsonb(it));
end $$;

create or replace function public.use_item(p_item_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); it public.items; qty integer; prof public.profiles; msg text; bonus integer := 0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into it from public.items where code = p_item_code;
  if it is null then raise exception 'Item not found'; end if;
  select quantity into qty from public.inventory where user_id = uid and item_code = it.code for update;
  if coalesce(qty,0) < 1 then raise exception 'You do not own this item'; end if;
  update public.inventory set quantity = quantity - 1 where user_id = uid and item_code = it.code;
  insert into public.player_effects (user_id) values (uid) on conflict do nothing;

  if it.effect = 'xp_100' then
    perform public.grant_rewards(uid, 100, 0, 'item', it.name);
    msg := '+100 XP added.';
  elsif it.effect = 'streak_shield' then
    update public.player_effects set streak_shields = streak_shields + 1 where user_id = uid;
    msg := 'Streak Shield armed. One missed day is protected.';
  elsif it.effect = 'xp_boost' then
    update public.player_effects set xp_boost_quests_left = xp_boost_quests_left + 3 where user_id = uid;
    msg := 'Double XP active for your next 3 quests.';
  else
    bonus := 50 + floor(random() * 250)::int;
    perform public.grant_rewards(uid, 0, bonus, 'item', 'Mystery Chest');
    msg := 'The chest contained ' || bonus || ' gold!';
  end if;

  return jsonb_build_object('message', msg, 'unlocked', public.check_achievements(uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid));
end $$;

create or replace function public.record_social_share(p_kind text, p_platform text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); newly boolean := false;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.social_shares (user_id, kind, platform, verification)
  values (uid, p_kind, p_platform, 'user_confirmed');
  if not exists (select 1 from public.user_achievements where user_id = uid and code = 'community_creator') then
    insert into public.user_achievements (user_id, code) values (uid, 'community_creator');
    update public.profiles set gold = gold + 150 where id = uid;
    insert into public.transactions (user_id, kind, gold_delta, description)
    values (uid, 'achievement', 150, 'Community Creator');
    newly := true;
  end if;
  return jsonb_build_object('badge_awarded', newly);
end $$;

create or replace function public.join_community(p_community_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.community_members (community_id, user_id) values (p_community_id, uid) on conflict do nothing;
  update public.communities set member_count = (select count(*) from public.community_members where community_id = p_community_id)
   where id = p_community_id;
  if not exists (select 1 from public.user_achievements where user_id = uid and code = 'social_butterfly') then
    insert into public.user_achievements (user_id, code) values (uid, 'social_butterfly');
    update public.profiles set gold = gold + 100 where id = uid;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.leave_community(p_community_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  delete from public.community_members where community_id = p_community_id and user_id = uid;
  update public.communities set member_count = (select count(*) from public.community_members where community_id = p_community_id)
   where id = p_community_id;
end $$;

create or replace function public.get_leaderboard(p_period text default 'all')
returns table (user_id uuid, display_name text, avatar_emoji text, title text, level integer, score integer, streak integer)
language sql stable security definer set search_path = public as $$
  with scores as (
    select p.id, p.display_name, p.avatar_emoji, p.title, p.level, p.current_streak,
      case p_period
        when 'week' then coalesce((select sum(da.xp_earned)::int from public.daily_activity da
             where da.user_id = p.id and da.day >= current_date - 6), 0)
        when 'month' then coalesce((select sum(da.xp_earned)::int from public.daily_activity da
             where da.user_id = p.id and da.day >= current_date - 29), 0)
        else p.xp end as score
    from public.profiles p
    where p.is_public or p.id = auth.uid()
  )
  select id, display_name, avatar_emoji, title, level, score, current_streak
  from scores order by score desc, level desc limit 100
$$;

create or replace function public.get_community_leaderboard(p_community_id uuid)
returns table (user_id uuid, display_name text, avatar_emoji text, level integer, score integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_emoji, p.level,
    coalesce((select sum(da.xp_earned)::int from public.daily_activity da
      where da.user_id = p.id and da.day >= current_date - 29), 0)
  from public.community_members m join public.profiles p on p.id = m.user_id
  where m.community_id = p_community_id
  order by 5 desc limit 50
$$;

-- seed starter communities (system owned)
insert into public.communities (slug,name,emoji,description) values
 ('dsa-warriors','DSA Warriors','💻','Daily algorithm practice, together.'),
 ('startup-builders','Startup Builders','🚀','Ship something every week.'),
 ('book-club','Book Club','📚','Read consistently, share insights.'),
 ('fitness-squad','Fitness Squad','💪','Move your body every single day.'),
 ('placement-prep','Placement Prep','🎓','Interviews, DSA, projects, resumes.'),
 ('productivity-masters','Productivity Masters','🧠','Systems, focus and consistency.');
