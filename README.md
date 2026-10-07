# 🚀 up2git - GitHub ZIP File Uploader

Web App progresif (*Pure Frontend / Vanilla JS tanpa framework*) yang dirancang khusus untuk mempermudah developer mengupload file ZIP lewat HP/mobile, mengekstrak isi ZIP langsung di dalam browser secara otomatis, dan mengupload seluruh struktur folder beserta file di dalamnya ke GitHub Repository menggunakan Personal Access Token (PAT).

Dilengkapi dengan sistem desain **Clean Glassmorphism** beropsi **Light & Dark Mode** interaktif.

---

## ✨ Fitur Utama

1. **🔐 Autentikasi Aman 100% Client-Side:**
   - Mendukung GitHub Personal Access Token (*classic* maupun *fine-grained*).
   - Token disimpan **hanya di SessionStorage** browser lokal Anda (hilang saat tab ditutup) dan tidak pernah dikirim ke server pihak ketiga mana pun.
   - Menampilkan informasi profil lengkap: Foto Avatar, Username, Nama, Bio, dan Statistik Repo.

2. **📂 Manajemen Repository Lengkap:**
   - Mengambil daftar repository Public & Private milik user secara otomatis.
   - Fitur pencarian instan (*real-time filter*).
   - Buat Repository Baru (Public/Private) langsung dari genggaman HP Anda.

3. **🗜️ ZIP Extractor & Batch Uploader:**
   - Ekstrak seluruh isi file ZIP secara rekursif di dalam browser menggunakan **JSZip**.
   - Mempertahankan struktur *nested folder* secara presisi.
   - Mengonversi file ke format Base64 dan mengupload secara berurutan (*sequential batch PUT*) untuk mencegah *rate-limit* GitHub API.
   - Mendukung penimpaan file lama (*overwrite support via file SHA check*).
   - Progress bar interaktif & konsol log real-time.

4. **🧹 Manajemen Repository:**
   - Reset repository untuk menghapus seluruh file pada branch default tanpa menghapus repository.
   - Hapus repository secara permanen dengan konfirmasi.

5. **🍎 Desain UI/UX Light/Dark Glassmorphism:**
   - **Monochrome Glassmorphism:** Tampilan bersih (*clean*) berpadu dengan efek kaca buram (*frosted glass*).
   - **Theme Switcher:** Mendukung deteksi otomatis tema sistem operasi HP Anda serta tombol manual (*toggle Sun/Moon*) yang menyimpan preferensi Anda.
   - **Dynamic Island Bottom Nav:** Bar navigasi mengambang berbentuk kapsul (*pill*) dengan indikator ekspansi teks yang sangat mulus.

---

## 📁 Struktur File Project

Project ini dibuat sangat rapi dan modular di bawah batas 10–15 file:

```text
├── index.html       # Struktur utama aplikasi up2git & 5 Views (Home, Repos, Upload, New Repo, Tutorial)
├── css/
│   └── style.css    # Sistem desain iOS 26 Light/Dark Glassmorphism & responsive mobile
├── js/
│   ├── github.js    # Wrapper REST API GitHub (Auth, Repos, Create Repo, SHA Check, Upload Content)
│   ├── zip.js       # Handler JSZip (Inspeksi, ekstraksi folder, konversi Base64)
│   ├── ui.js        # UI Manager (View transitions, Toasts, iOS Modals, Progress bar, dynamic DOM)
│   └── app.js       # Controller utama koordinator event, theme switcher & logika batch upload
├── vercel.json      # Konfigurasi optimasi static deploy Vercel
└── README.md        # Dokumentasi project up2git
```

---

## 🚀 Cara Deploy ke GitHub Pages

1. Buat repository baru di GitHub (misalnya `up2git`).
2. Upload seluruh file project ini ke dalam repository tersebut.
3. Buka tab **Settings** di repository Anda.
4. Di menu sebelah kiri, klik **Pages**.
5. Pada bagian **Build and deployment** -> **Source**, pilih `Deploy from a branch`.
6. Pilih branch `main` (atau `master`) dan folder `/ (root)`, lalu klik **Save**.
7. Dalam 1–2 menit, web Anda siap diakses melalui URL GitHub Pages Anda!

---

## ⚡ Cara Deploy ke Vercel

Karena aplikasi ini adalah *Pure Static Frontend*, deploy ke Vercel sangat cepat tanpa perlu konfigurasi build step:

1. Login ke akun [Vercel](https://vercel.com).
2. Klik tombol **Add New...** -> **Project**.
3. Import repository GitHub tempat Anda menyimpan source code project ini.
4. Bagian **Framework Preset** biarkan `Other` atau `Static`.
5. Klik **Deploy**.
6. Selesai! Web Anda langsung mendapatkan sertifikat HTTPS gratis dan CDN global super cepat.

---

## 📖 Cara Pembuatan Personal Access Token (PAT)

1. Buka [GitHub Token Settings](https://github.com/settings/tokens).
2. Klik **Generate new token (classic)**.
3. Centang minimal scope:
   - `repo` (Full control of private repositories)
   - `read:user` (Read all user profile data)
4. Klik **Generate token**, lalu **Salin & Simpan token tersebut**.
