-- Feedback without an account, with daily limits.
--
-- After this runs, the browser can no longer insert into feedback directly.
-- Every message goes through the Netlify function, which calls
-- submit_feedback() below. The limits live here in the database, so they
-- hold even if someone skips the app and calls Supabase themselves.
--
--   7 messages per person per day   (signed in: per account, guest: per IP)
--   70 messages per day in total
--   1,000 characters per message
--   the day resets at midnight India time
--
-- Safe to run more than once.

-- 1. Guests have no account, so user_id becomes optional.
alter table public.feedback alter column user_id drop not null;

-- 2. Scrambled IP for counting guests. Never the real address.
alter table public.feedback add column if not exists ip_hash text;

-- 3. Hard length limit. NOT VALID leaves any older, longer rows alone.
alter table public.feedback drop constraint if exists feedback_body_length;
alter table public.feedback
  add constraint feedback_body_length check (char_length(body) <= 1000) not valid;

-- 4. The daily counts filter by time, so index it.
create index if not exists feedback_created_at_idx
  on public.feedback (created_at);

-- 5. Close the direct route. Reading and marking read are untouched.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.feedback', p.policyname);
  end loop;
end $$;

revoke insert on public.feedback from anon, authenticated;

-- 6. The only way in. Checks both limits and saves in one step; the lock
--    stops two messages arriving at once from both slipping past the count.
create or replace function public.submit_feedback(
  p_body text,
  p_user_id uuid,
  p_ip_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamptz :=
    date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  total_today int;
  mine_today int;
begin
  if p_body is null or char_length(btrim(p_body)) = 0 then
    return 'empty';
  end if;

  if char_length(btrim(p_body)) > 1000 then
    return 'too_long';
  end if;

  perform pg_advisory_xact_lock(hashtext('submit_feedback'));

  select count(*) into total_today
  from feedback
  where created_at >= day_start;

  if total_today >= 70 then
    return 'daily_limit';
  end if;

  if p_user_id is not null then
    select count(*) into mine_today
    from feedback
    where created_at >= day_start and user_id = p_user_id;
  else
    select count(*) into mine_today
    from feedback
    where created_at >= day_start and ip_hash = p_ip_hash;
  end if;

  if mine_today >= 7 then
    return 'person_limit';
  end if;

  insert into feedback (body, user_id, ip_hash)
  values (btrim(p_body), p_user_id, p_ip_hash);

  return 'ok';
end;
$$;

revoke all on function public.submit_feedback(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.submit_feedback(text, uuid, text)
  to service_role;

-- 7. Check: what policies are left on feedback. Paste this result back.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'feedback'
order by cmd, policyname;