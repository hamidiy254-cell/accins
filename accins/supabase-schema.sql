-- ACCINS Database Schema
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text, phone text, address text, city text,
  role text default 'user' check (role in ('user','admin')),
  created_at timestamptz default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text,
  price numeric(10,2) not null, old_price numeric(10,2),
  image_url text, images text[] default '{}', stock int default 0,
  store text, is_active boolean default true,
  created_at timestamptz default now()
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text check (discount_type in ('percent','fixed')) not null,
  discount_value numeric(10,2) not null,
  max_uses int, used_count int default 0,
  expires_at timestamptz, is_active boolean default true,
  created_at timestamptz default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number serial,
  user_id uuid references auth.users on delete set null,
  customer_name text not null, phone text not null,
  address text not null, city text not null, note text, store text,
  coupon_code text, subtotal numeric(10,2) not null,
  discount numeric(10,2) default 0, total numeric(10,2) not null,
  status text default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  created_at timestamptz default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders on delete cascade not null,
  product_id uuid references public.products on delete set null,
  product_name text not null, quantity int not null,
  unit_price numeric(10,2) not null, store text
);
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, phone, address, city)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone',
          new.raw_user_meta_data->>'address', new.raw_user_meta_data->>'city');
  return new;
end; $$;
create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "profiles self" on public.profiles for all using (auth.uid() = id);
create policy "products public read" on public.products for select using (is_active = true);
create policy "products admin all" on public.products for all using (
  exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "coupons admin all" on public.coupons for all using (
  exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "orders admin all" on public.orders for all using (
  exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "orders own read" on public.orders for select using (auth.uid() = user_id);
create policy "orders guest insert" on public.orders for insert with check (true);
create policy "order_items admin all" on public.order_items for all using (
  exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "order_items own read" on public.order_items for select using (
  exists(select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "order_items insert" on public.order_items for insert with check (true);

insert into storage.buckets (id, name, public) values ('products','products', true)
  on conflict (id) do nothing;
create policy "products img public" on storage.objects for select using (bucket_id = 'products');
create policy "products img admin upload" on storage.objects for insert with check (
  bucket_id = 'products' and exists(
    select 1 from public.profiles where id = auth.uid() and role = 'admin'));