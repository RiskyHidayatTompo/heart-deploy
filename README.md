# Prediksi Penyakit Jantung: versi Netlify + Supabase

Situs statis. Seluruh pipeline ML (cleaning, EDA, encoding, split, Logistic Regression, Random Forest)
berjalan di browser dengan JavaScript. Supabase dipakai untuk dataset, login admin, riwayat prediksi,
dan penyimpanan foto screenshot.

## Isi folder
- `index.html`  : tampilan dan logika aplikasi
- `ml.js`       : implementasi pipeline dan model
- `config.js`   : tempat mengisi URL dan anon key Supabase
- `supabase.sql`: tabel, aturan keamanan (RLS), dan bucket foto
- `netlify.toml`: konfigurasi Netlify
- (opsional) `heart.csv` : taruh di folder ini agar tombol "Muat heart.csv bawaan situs" berfungsi

## A. Uji di komputer sendiri
```
python -m http.server 8000
```
Buka http://localhost:8000 (jangan buka index.html langsung dari Explorer karena fetch bisa diblokir).

## B. Siapkan Supabase (opsional, situs tetap jalan tanpa ini)
1. Buat project di https://supabase.com.
2. SQL Editor > New query > tempel isi `supabase.sql` > Run.
3. Authentication > Providers > Email: matikan "Allow new users to sign up".
   Authentication > Users > Add user: buat akun admin (email + kata sandi).
4. Project Settings > API: salin **Project URL** dan **anon public key** ke `config.js`.
   Jangan pakai service_role key.

## C. Deploy ke Netlify
Cara termudah: buka https://app.netlify.com/drop lalu seret folder ini.
Atau lewat Git: push ke GitHub > Netlify > Add new site > Import project > Publish directory `.`
(tanpa build command).

## Catatan
- Model dilatih ulang di browser dengan implementasi JavaScript buatan sendiri, jadi angkanya bisa berbeda
  tipis dari scikit-learn di Colab. Untuk laporan resmi, pakai angka dari Colab.
- Semua pengunjung boleh membaca dataset dan menambah riwayat prediksi; hanya admin yang login yang bisa
  melihat riwayat, menyimpan dataset, dan mengunggah foto (diatur oleh aturan RLS di supabase.sql).
