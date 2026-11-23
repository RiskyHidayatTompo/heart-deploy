-- Jalankan di Supabase: SQL Editor > New query > Run. Aman dijalankan ulang (idempotent).
-- Cocok untuk instalasi baru MAUPUN pembaruan dari versi sebelumnya.

create table if not exists heart_data (
  id bigint generated always as identity primary key,
  "Age" int, "Sex" text, "ChestPainType" text, "RestingBP" int, "Cholesterol" int,
  "FastingBS" int, "RestingECG" text, "MaxHR" int, "ExerciseAngina" text,
  "Oldpeak" real, "ST_Slope" text, "HeartDisease" int
);
create table if not exists predictions (
  id bigint generated always as identity primary key,
  input jsonb not null, prob_lr real, prob_rf real,
  created_at timestamptz default now()
);
alter table predictions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table predictions add column if not exists user_email text;
create table if not exists admins (user_id uuid primary key references auth.users(id) on delete cascade);

alter table heart_data  enable row level security;
alter table predictions enable row level security;
alter table admins      enable row level security;

create or replace function is_admin() returns boolean
language sql security definer set search_path = public stable
as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

-- Pemilik riwayat selalu diisi server dari akun yang login (tidak bisa dipalsukan dari browser)
create or replace function set_prediction_owner() returns trigger
language plpgsql security definer set search_path = public
as $$ begin new.user_id := auth.uid(); new.user_email := auth.jwt() ->> 'email'; return new; end $$;
drop trigger if exists trg_prediction_owner on predictions;
create trigger trg_prediction_owner before insert on predictions
  for each row execute function set_prediction_owner();

-- Hapus kebijakan lama
drop policy if exists "baca dataset" on heart_data;
drop policy if exists "admin tulis dataset" on heart_data;
drop policy if exists "pengunjung simpan prediksi" on predictions;
drop policy if exists "admin baca prediksi" on predictions;
drop policy if exists "admin hapus prediksi" on predictions;
drop policy if exists "baca screenshot" on storage.objects;
drop policy if exists "admin upload screenshot" on storage.objects;
drop policy if exists "admin hapus screenshot" on storage.objects;

-- Dataset: semua boleh membaca, hanya admin yang boleh mengubah
create policy "baca dataset" on heart_data for select using (true);
create policy "admin tulis dataset" on heart_data for all to authenticated
  using (is_admin()) with check (is_admin());

-- Prediksi: harus login. Pengguna hanya melihat/menghapus miliknya, admin melihat semua
create policy "login simpan prediksi" on predictions for insert to authenticated with check (auth.uid() is not null);
create policy "baca prediksi sendiri atau admin" on predictions for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "hapus prediksi sendiri atau admin" on predictions for delete to authenticated
  using (user_id = auth.uid() or is_admin());

-- Pengguna hanya boleh mengecek apakah dirinya admin
drop policy if exists "cek admin sendiri" on admins;
create policy "cek admin sendiri" on admins for select to authenticated using (user_id = auth.uid());

-- Foto screenshot
insert into storage.buckets (id, name, public) values ('screenshots','screenshots',true) on conflict do nothing;
create policy "baca screenshot" on storage.objects for select using (bucket_id = 'screenshots');
create policy "admin upload screenshot" on storage.objects for insert to authenticated
  with check (bucket_id = 'screenshots' and is_admin());
create policy "admin hapus screenshot" on storage.objects for delete to authenticated
  using (bucket_id = 'screenshots' and is_admin());

-- JADIKAN AKUN ANDA ADMIN: ganti email di bawah, lalu jalankan baris ini
insert into admins (user_id) select id from auth.users where email = 'GANTI_DENGAN_EMAIL_ADMIN@contoh.com'
on conflict do nothing;
