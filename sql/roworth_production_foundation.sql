-- RoWorth production foundation
-- Run after roworth_bootstrap.sql and roworth_tz_upgrade.sql.

create extension if not exists pgcrypto;

alter table if exists public.users
  add column if not exists premium_until timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.offers
  add column if not exists boosted_until timestamptz,
  add column if not exists boost_score integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.orders
  add column if not exists paid_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz;

create table if not exists public.wallet_transactions (
  id text primary key default ('wtx_' || replace(gen_random_uuid()::text, '-', '')),
  user_id text not null references public.users(id) on delete cascade,
  currency text not null check (currency in ('STARS', 'ROBUX')),
  amount integer not null check (amount <> 0),
  balance_after integer not null,
  type text not null,
  reason text not null default '',
  ref_type text,
  ref_id text,
  created_by text references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.offer_boosts (
  id text primary key default ('boost_' || replace(gen_random_uuid()::text, '-', '')),
  offer_id text not null references public.offers(id) on delete cascade,
  seller_id text not null references public.users(id) on delete cascade,
  package_id text not null,
  currency text not null default 'STARS' check (currency in ('STARS', 'ROBUX')),
  price integer not null check (price >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id text primary key,
  label text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id text primary key,
  label text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id text not null references public.roles(id) on delete cascade,
  permission_id text not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id text not null references public.users(id) on delete cascade,
  role_id text not null references public.roles(id) on delete cascade,
  assigned_by text references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.admin_audit_logs (
  id text primary key default ('audit_' || replace(gen_random_uuid()::text, '-', '')),
  actor_uid text references public.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.roles (id, label, description, is_system)
values
  ('owner', 'Владелец', 'Полный контроль проекта и ролей.', true),
  ('tech_admin', 'Тех. админ', 'Технические настройки, логи и инфраструктура.', true),
  ('admin', 'Админ', 'Управление пользователями, товарами, балансами и модерацией.', true),
  ('moderator', 'Модератор', 'Модерация товаров, жалоб и отзывов.', true),
  ('support', 'Саппорт', 'Поддержка пользователей и сервисные сообщения.', true),
  ('user', 'Обычный пользователь', 'Базовый пользователь маркетплейса.', true),
  ('seller', 'Продавец', 'Пользователь, который публикует товары.', true),
  ('premium_seller', 'Premium-продавец', 'Продавец с premium-привилегиями.', true)
on conflict (id) do update
set label = excluded.label,
    description = excluded.description,
    updated_at = now();

insert into public.permissions (id, label, description)
values
  ('manage_users', 'Управление пользователями', 'Баны, верификация, статусы и профильные флаги.'),
  ('manage_offers', 'Управление товарами', 'Модерация и управление товарами.'),
  ('moderate_reports', 'Модерация жалоб', 'Просмотр и обработка жалоб.'),
  ('manage_balance', 'Управление балансом', 'Ручные корректировки баланса через ledger.'),
  ('manage_boosts', 'Управление бустами', 'Просмотр и ручное управление бустами.'),
  ('manage_roles', 'Управление ролями', 'Выдача ролей и настройка permissions.'),
  ('view_logs', 'Просмотр логов', 'Просмотр audit logs и административной статистики.'),
  ('project_settings', 'Настройки проекта', 'Доступ к техническим настройкам проекта.'),
  ('support_messages', 'Сообщения поддержки', 'Отправка системных сообщений пользователям.'),
  ('refund_orders', 'Возвраты заказов', 'Оформление возвратов и отмен заказов.'),
  ('delete_reviews', 'Удаление отзывов', 'Удаление отзывов с пересчетом рейтинга.')
on conflict (id) do update
set label = excluded.label,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select 'owner', id from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
values
  ('tech_admin', 'view_logs'),
  ('tech_admin', 'project_settings'),
  ('tech_admin', 'manage_boosts'),
  ('admin', 'manage_users'),
  ('admin', 'manage_offers'),
  ('admin', 'moderate_reports'),
  ('admin', 'manage_balance'),
  ('admin', 'manage_boosts'),
  ('admin', 'view_logs'),
  ('admin', 'support_messages'),
  ('admin', 'refund_orders'),
  ('admin', 'delete_reviews'),
  ('moderator', 'manage_offers'),
  ('moderator', 'moderate_reports'),
  ('moderator', 'delete_reviews'),
  ('support', 'support_messages')
on conflict do nothing;

delete from public.role_permissions
where role_id = 'support'
  and permission_id <> 'support_messages';

insert into public.user_roles (user_id, role_id)
select id, 'admin'
from public.users
where is_admin = true
on conflict do nothing;

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions(user_id, created_at desc);

create index if not exists wallet_transactions_ref_idx
  on public.wallet_transactions(ref_type, ref_id);

create index if not exists offer_boosts_offer_status_idx
  on public.offer_boosts(offer_id, status, ends_at desc);

create index if not exists offers_boost_feed_idx
  on public.offers(boosted_until desc, boost_score desc, created_at desc);

create index if not exists orders_buyer_created_idx
  on public.orders(buyer_uid, created_at desc);

create index if not exists user_roles_user_idx
  on public.user_roles(user_id);

create index if not exists admin_audit_logs_actor_created_idx
  on public.admin_audit_logs(actor_uid, created_at desc);

create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs(target_type, target_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];


create or replace function public.adjust_user_balance(
  p_user_id text,
  p_currency text,
  p_amount integer,
  p_type text,
  p_reason text,
  p_ref_type text default null,
  p_ref_id text default null,
  p_created_by text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(stars integer, robux integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stars integer;
  current_robux integer;
  next_stars integer;
  next_robux integer;
  balance_after integer;
begin
  if p_currency not in ('STARS', 'ROBUX') then
    raise exception 'invalid_currency';
  end if;

  if p_amount = 0 then
    raise exception 'amount_must_not_be_zero';
  end if;

  select u.stars, u.robux
    into current_stars, current_robux
  from public.users u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  next_stars := current_stars;
  next_robux := current_robux;

  if p_currency = 'STARS' then
    next_stars := current_stars + p_amount;
    balance_after := next_stars;
  else
    next_robux := current_robux + p_amount;
    balance_after := next_robux;
  end if;

  if balance_after < 0 then
    raise exception 'insufficient_funds';
  end if;

  update public.users
  set stars = next_stars,
      robux = next_robux,
      updated_at = now()
  where id = p_user_id;

  insert into public.wallet_transactions (
    user_id,
    currency,
    amount,
    balance_after,
    type,
    reason,
    ref_type,
    ref_id,
    created_by,
    metadata
  )
  values (
    p_user_id,
    p_currency,
    p_amount,
    balance_after,
    p_type,
    coalesce(p_reason, ''),
    p_ref_type,
    p_ref_id,
    p_created_by,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query select next_stars, next_robux;
end;
$$;

revoke all on function public.adjust_user_balance(text, text, integer, text, text, text, text, text, jsonb) from public;
grant execute on function public.adjust_user_balance(text, text, integer, text, text, text, text, text, jsonb) to service_role;

alter table public.users enable row level security;
alter table public.offers enable row level security;
alter table public.orders enable row level security;
alter table public.purchases enable row level security;
alter table public.reviews enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.offer_boosts enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Public marketplace reads. Sensitive mutations are handled by server routes with the service role key.
drop policy if exists users_public_select on public.users;
create policy users_public_select
  on public.users for select
  using (true);

drop policy if exists offers_public_select on public.offers;
create policy offers_public_select
  on public.offers for select
  using (true);

drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select
  on public.reviews for select
  using (true);

drop policy if exists offer_boosts_public_select on public.offer_boosts;
create policy offer_boosts_public_select
  on public.offer_boosts for select
  using (status = 'active' and ends_at > now());

drop policy if exists roles_public_select on public.roles;
drop policy if exists permissions_public_select on public.permissions;
drop policy if exists role_permissions_public_select on public.role_permissions;

alter table public.messages enable row level security;

drop policy if exists messages_legacy_select on public.messages;
drop policy if exists messages_legacy_insert on public.messages;
drop policy if exists messages_legacy_update on public.messages;
