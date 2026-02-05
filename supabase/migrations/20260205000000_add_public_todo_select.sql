-- Allow public read of todos for profiles marked as public
create policy "dashboard_todos_select_public_profile"
  on public.dashboard_todos
  for select
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = dashboard_todos.user_id
        and up.is_public = true
    )
  );
