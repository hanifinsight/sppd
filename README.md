# SPPD — Frontend

Frontend baru menggunakan Next.js App Router, TypeScript, Tailwind CSS, dan Supabase SSR.

## Menjalankan lokal
1. Gunakan Node.js 20.9 atau lebih baru.
2. Salin `.env.example` menjadi `.env.local`.
3. Isi URL dan publishable key Supabase yang sama dengan proyek SPPD yang sudah ada.
4. Jalankan `npm install`, lalu `npm run dev`.

## Prinsip integrasi
- Frontend ini tidak membuat atau mengubah schema/database Supabase.
- Jangan pernah menaruh service-role key di browser atau variabel berawalan NEXT_PUBLIC_.
- Login harus mempertahankan alur Edge Function `username-login`, kemudian membentuk sesi Supabase Auth.
- Profil akun dibaca dari tabel `user_akun`; validasi role/aktif dilakukan di server sebelum halaman privat dirilis.
- Nilai pada dashboard saat ini adalah data contoh UI, bukan angka live dari database.

## Status
Tahap awal: kerangka Next.js dan dashboard premium. Modul autentikasi, pembacaan data live, role authorization, serta CRUD akan diintegrasikan bertahap setelah kontrak tabel dan Edge Function diverifikasi.