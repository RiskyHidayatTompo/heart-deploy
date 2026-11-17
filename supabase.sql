-- Jalankan di Supabase: SQL Editor > New query > Run
-- Admin = pengguna yang Anda buat manual di Authentication > Users (matikan "Allow new users to sign up").

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

alter table heart_data  enable row level security;
alter table predictions enable row level security;

-- Dataset: semua orang boleh membaca, hanya admin yang boleh mengubah
create policy "baca dataset" on heart_data for select using (true);
create policy "admin tulis dataset" on heart_data for all to authenticated using (true) with check (true);

-- Prediksi: pengunjung boleh menambah, hanya admin yang boleh melihat/menghapus
create policy "pengunjung simpan prediksi" on predictions for insert to anon, authenticated with check (true);
create policy "admin baca prediksi" on predictions for select to authenticated using (true);
create policy "admin hapus prediksi" on predictions for delete to authenticated using (true);

-- Penyimpanan foto screenshot (bucket publik untuk dibaca, admin untuk upload)
insert into storage.buckets (id, name, public) values ('screenshots','screenshots',true) on conflict do nothing;
create policy "baca screenshot" on storage.objects for select using (bucket_id = 'screenshots');
create policy "admin upload screenshot" on storage.objects for insert to authenticated with check (bucket_id = 'screenshots');
create policy "admin hapus screenshot" on storage.objects for delete to authenticated using (bucket_id = 'screenshots');
