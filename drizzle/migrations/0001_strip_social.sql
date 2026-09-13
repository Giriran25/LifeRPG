-- ============================================================================
-- 0001_strip_social.sql
-- Life RPG: remove the community / leaderboard / AI-coach / social-share layer
-- and the pay-to-win XP boost. Keeps streak_shields (non-punitive streak repair).
-- ============================================================================

-- ---------- functions that depend on the social tables ----------
drop function if exists public.get_community_leaderboard(uuid);
drop function if exists public.get_leaderboard(text);
drop function if exists public.join_community(uuid);
drop function if exists public.leave_community(uuid);
drop function if exists public.record_social_share(text, text);

-- ---------- complete_quest: drop the challenge rollup + xp_boost doubling ----
-- (Recreated in full, without the community_challenges update and without the
--  xp_boost branch. 0002 replaces this again with the Life RPG version; this
--  intermediate definition keeps the database consistent if 0002 is not yet run.)
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

  xp_award := q.xp_reward;
  gold_award := q.gold_reward;

  update public.quests set status = 'completed', completed_at = now() where id = q.id;
  insert into public.quest_completions (user_id, quest_id, day, xp_awarded, gold_awarded, category)
  values (uid, q.id, today, xp_award, gold_award, q.category);

  insert into public.daily_activity (user_id, day, quests_completed, xp_earned, gold_earned)
  values (uid, today, 1, xp_award, gold_award)
  on conflict (user_id, day) do update
    set quests_completed = public.daily_activity.quests_completed + 1,
        xp_earned = public.daily_activity.xp_earned + xp_award,
        gold_earned = public.daily_activity.gold_earned + gold_award;

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

-- ---------- use_item: drop the xp_boost and mystery-chest branches ----------
create or replace function public.use_item(p_item_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); it public.items; qty integer; msg text;
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
  else
    raise exception 'This item cannot be used';
  end if;

  return jsonb_build_object('message', msg, 'unlocked', public.check_achievements(uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid));
end $$;

-- ---------- social tables, FK-safe order ----------
drop table if exists public.challenge_participants;
drop table if exists public.community_challenges;
drop table if exists public.post_reactions;
drop table if exists public.community_posts;
drop table if exists public.community_members;
drop table if exists public.communities;
drop table if exists public.ai_recommendations;
drop table if exists public.social_shares;

-- ---------- social achievements (no longer reachable) ----------
delete from public.user_achievements where code in ('community_creator','social_butterfly');
delete from public.achievements where code in ('community_creator','social_butterfly');

-- ---------- pay-to-win + loot box removal ----------
delete from public.inventory where item_code in ('xp_boost','mystery_chest');
delete from public.items where code in ('xp_boost','mystery_chest');
alter table public.player_effects drop column if exists xp_boost_quests_left;
