-- QA helper functions for E2E testing

-- Function to make a user admin (only for @e2e.local emails)
create or replace function public.qa_make_self_admin()
returns json language plpgsql security definer set search_path = public as $$
declare 
  u uuid; 
  em text;
begin
  select auth.uid() into u;
  if u is null then
    return json_build_object('ok', false, 'error', 'not-authenticated');
  end if;
  
  select email into em from auth.users where id = u;
  if em is null then
    return json_build_object('ok', false, 'error', 'no-email');
  end if;
  
  if right(lower(em), 10) <> '@e2e.local' then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  
  -- Update or insert profile with admin role
  insert into public.users_profile (id, role) 
  values (u, 'admin')
  on conflict (id) 
  do update set role = 'admin';
  
  return json_build_object('ok', true);
end $$;

grant execute on function public.qa_make_self_admin() to authenticated;

-- Function to clean test data for @e2e.local users
create or replace function public.qa_reset_test_data()
returns json language plpgsql security definer set search_path = public as $$
begin
  -- Delete receipts for @e2e.local users
  delete from receipts
  where user_id in (
    select up.id 
    from users_profile up
    join auth.users au on au.id = up.id
    where right(lower(au.email), 10) = '@e2e.local'
  );
  
  -- Delete points ledger for @e2e.local users
  delete from points_ledger
  where user_id in (
    select up.id 
    from users_profile up
    join auth.users au on au.id = up.id
    where right(lower(au.email), 10) = '@e2e.local'
  );
  
  return json_build_object('ok', true);
end $$;

grant execute on function public.qa_reset_test_data() to authenticated;