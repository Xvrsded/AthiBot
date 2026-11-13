# 🍑 Athibot - Discord Bot Resmi Athi Store

**Athibot** adalah bot Discord modern dan profesional yang dirancang khusus untuk operasional **Athi Store**. Dibangun menggunakan **Node.js 18+**, **discord.js v14**, dan **MongoDB (Mongoose)**, bot ini menyediakan otomatisasi pemesanan Robux, sistem tiket interaktif, log transaksi berbasis embed, manajemen katalog produk, serta fitur utilitas komunitas.

---

## 🌟 Fitur Utama

### 1. 🎫 Sistem Tiket Interaktif (Interactive Ticket Panel)
- Panel tiket berbasis tombol Discord yang intuitif (`/ticket-panel`).
- Kategori tiket lengkap:
  - 🛍️ **Order Robux** — Transaksi dan pembelian Robux.
  - 🛠️ **Bantuan / Support** — Pertanyaan umum seputar layanan toko.
  - ⚠️ **Lapor Kendala** — Penyelesaian masalah pesanan / komplain.
- Saluran channel privat otomatis antara pembeli dan tim staff.
- Fitur **Klaim Tiket** (`Claim`) oleh staf untuk mencegah tumpang tindih penanganan.
- Fitur **Tutup Tiket** (`Close`) dengan konfirmasi dan pencatatan log transaksi berbasis embed.
- Penyimpanan riwayat tiket di database MongoDB.

### 2. 🛒 Manajemen Toko & Pemesanan Robux (Shop & Orders)
- **Katalog Pricelist Lengkap (`/pricelist`)**:
  - 🍑 **ROBUX VIA USERNAME**: 25r hingga 1000r (berlaku kelipatan).
  - 🍑 **ROBUX VILOG**: 80 hingga 1500 ROBUX dengan proses 1–15 menit.
  - Dropdown kategori interaktif dan tombol pesan langsung (**Order Sekarang**).
- **Formulir Pemesanan Interaktif (`/order`)**:
  - Modal form input langsung: Username Roblox, Jumlah/Kelipatan, Kontak WhatsApp, dan Catatan Tambahan.
- **Sistem Notifikasi Pesanan Masuk**:
  - Notifikasi otomatis ke channel log pesanan staf dengan rincian data lengkap.
  - Tombol aksi cepat untuk staf: **Terima (Accept)**, **Selesai (Complete)**, dan **Tolak (Reject)** dengan alasan.
  - Pembaruan status otomatis dikirimkan ke DM pembeli secara real-time.
- **Manajemen Produk oleh Admin (`/product`)**:
  - Tambah, edit harga/status, lihat daftar, dan hapus produk dari database.

### 3. ℹ️ Utilitas & Manajemen Komunitas
- `/ping`: Menampilkan latensi Discord WebSocket, bot roundtrip, dan latensi MongoDB ping.
- `/help`: Panduan lengkap daftar command bot dengan kategori rapi.
- `/serverinfo` & `/userinfo`: Informasi detail statistik server dan profil member.
- **Sistem Welcome & Goodbye**: Pesan sambutan dan perpisahan otomatis yang dapat dikustomisasi per server via command `/config`.
- **Perlindungan Channel Keamanan**: Pesan user non-admin/staff di channel keamanan akan memicu ban server sampai unban manual dan pembersihan pesan yang dapat diakses bot di seluruh server. User menerima instruksi untuk menghubungi Admin/Staff.

---

## 📋 Persyaratan Sistem

- **Node.js**: Versi `18.0.0` atau yang lebih baru (disarankan Node.js 20+ atau 22 LTS).
- **NPM**: Versi 9+ atau 10+.
- **MongoDB**: MongoDB Server lokal atau akun cloud gratis di [MongoDB Atlas](https://www.mongodb.com/atlas).
- **Akun Discord Developer**: Aplikasi bot dengan Privileged Intents diaktifkan.

---

## 🚀 Langkah Instalasi

### 1. Clone atau Buka Folder Project
Pastikan kamu berada di dalam direktori project bot:
```bash
cd athibot
```

### 2. Install Dependencies
Install library pendukung yang diperlukan:
```bash
npm install
```

### 3. Konfigurasi File Environment (.env)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
*(Di Windows PowerShell: `Copy-Item .env.example .env`)*

Buka file `.env` menggunakan teks editor (VS Code, Nano, Notepad, dsb.) dan isi nilainya.

---

## 🔑 Cara Mendapatkan Setiap Nilai .env

| Variabel | Deskripsi | Cara Mendapatkannya |
| :--- | :--- | :--- |
| `TOKEN` | Token otentikasi Bot Discord | Buka [Discord Developer Portal](https://discord.com/developers/applications) ➜ Pilih Aplikasi ➜ Masuk ke tab **Bot** ➜ Klik **Reset Token** ➜ Salin token. |
| `CLIENT_ID` | Application ID Bot | Buka [Discord Developer Portal](https://discord.com/developers/applications) ➜ Masuk ke tab **General Information** ➜ Salin **Application ID**. |
| `GUILD_ID` | ID Server Discord utama | Buka Discord ➜ Masuk ke *User Settings* ➜ *Advanced* ➜ Aktifkan **Developer Mode** ➜ Klik kanan nama server Discord kamu ➜ Pilih **Copy Server ID**. |
| `MONGO_URI` | Koneksi database MongoDB | • **Lokal:** `mongodb://localhost:27017/athibot`<br>• **MongoDB Atlas:** Buka dashboard Atlas ➜ *Connect* ➜ *Connect your application* ➜ Salin connection string URI. |
| `EMBED_COLOR` | Warna HEX embed bot | Warna tema utama Athi Store (default: `#FF8474`). Bebas diubah sesuai selera. |
| `STAFF_ROLE_ID` | Role staff/admin penanggung jawab | Klik kanan Role staff di server kamu ➜ Pilih **Copy Role ID** (opsional, bisa via `/config staff-role`). |
| `TICKET_CATEGORY_ID` | Category tetap untuk seluruh channel tiket (`1570431160222228541`) | Semua jenis tiket dibuat otomatis di category ini. |
| `TRANSACTION_LOG_CHANNEL_ID` | Channel log transaksi berbasis embed | Klik kanan text channel log ➜ Pilih **Copy Channel ID**. |
| `ORDER_LOG_CHANNEL_ID` | Channel notifikasi order staff | Klik kanan text channel untuk order staff ➜ Pilih **Copy Channel ID** (opsional, bisa via `/config order`). |

> [!IMPORTANT]
> **Pastikan Privileged Gateway Intents Diaktifkan:**
> Masuk ke Discord Developer Portal ➜ Bot ➜ Gulir ke bawah ke bagian **Privileged Gateway Intents** ➜ Aktifkan ketiga opsi berikut:
> 1. **Presence Intent**
> 2. **Server Members Intent**
> 3. **Message Content Intent**
> Lalu klik **Save Changes**.

---

## 📦 Mengisi Data Awal Produk (Seeding)

Jalankan script seed untuk memasukkan 25 paket Robux resmi Athi Store (18 paket via Username dan 7 paket Vilog) ke database MongoDB:

```bash
npm run seed
```

---

## 📡 Mendaftarkan Slash Commands (Deploy)

Daftarkan semua slash command ke Discord API:

```bash
npm run deploy
```
*Catatan: Jika `GUILD_ID` diisi di file `.env`, commands akan langsung aktif seketika di server tersebut tanpa perlu menunggu propagasi global Discord.*

### 🧩 Memasang Panel & Rules Server

Jalankan script berikut untuk memasang panel layanan, embed rules, dan permission channel:

```bash
npm run setup-panels
```

Perintah tersebut memasang embed rules pada channel `1570116401333539038` dan mengatur
permission category `1570115603119734834`: member dapat melihat riwayat serta memberi reaction,
tetapi tidak dapat mengirim pesan. Channel `1570116755261759600` menjadi pengecualian agar
semua member dapat mengirim laporan akun yang ter-hack. Setiap auto-ban dicatat lengkap
(nama, avatar, ID, waktu pembuatan akun, isi pesan, lampiran, dan tautan pesan) pada channel
log `1570120342502899742`.

---

## ▶️ Menjalankan Bot

### Mode Pengembangan (Development)
Menjalankan bot dengan auto-restart saat ada perubahan kode:
```bash
npm run dev
```

### Mode Standar
```bash
npm start
```

---

## 🌐 Menjalankan di VPS Menggunakan PM2 (Produksi)

Untuk menjaga bot tetap berjalan 24/7 di VPS Linux/Windows bahkan setelah terminal ditutup atau VPS di-restart:

### 1. Install PM2 Secara Global (Bila belum terpasang)
```bash
npm install -g pm2
```

### 2. Jalankan Bot Menggunakan File Konfigurasi PM2
```bash
pm2 start ecosystem.config.js
```

### 3. Perintah Berguna PM2
- Melihat log aktivitas bot:
  ```bash
  pm2 logs athibot
  ```
- Melihat status bot:
  ```bash
  pm2 status
  ```
- Merestart bot:
  ```bash
  pm2 restart athibot
  ```
- Menghentikan bot:
  ```bash
  pm2 stop athibot
  ```
- Mengatur PM2 agar otomatis menyala saat VPS booting:
  ```bash
  pm2 startup
  pm2 save
  ```

---

## 📁 Struktur Direktori

```text
athibot/
 ├── .env.example              # Template variabel lingkungan
 ├── .gitignore                # Berkas yang diabaikan Git
 ├── ecosystem.config.js       # Konfigurasi PM2 untuk hosting VPS
 ├── package.json              # Konfigurasi dependensi & scripts NPM
 ├── README.md                 # Dokumentasi panduan lengkap
 └── src/
      ├── index.js             # Entry point utama aplikasi bot
      ├── commands/            # Direktori slash commands (berdasarkan kategori)
      │    ├── admin/          # Command khusus staf/admin
      │    │    ├── config.js         # Pengaturan server & welcome
      │    │    ├── order-manage.js   # Manajemen & status pesanan
      │    │    ├── product.js        # CRUD data produk di database
      │    │    └── ticket-panel.js   # Pengiriman panel tiket interaktif
      │    ├── general/        # Command umum pengguna
      │    │    ├── help.js           # Bantuan & daftar perintah
      │    │    ├── ping.js           # Latensi bot & status MongoDB
      │    │    ├── serverinfo.js     # Informasi server Discord
      │    │    └── userinfo.js       # Informasi profil pengguna
      │    └── shop/           # Command toko Athi Store
      │         ├── order.js          # Formulir pemesanan Robux
      │         └── pricelist.js      # Katalog daftar harga Robux
      ├── events/              # Event handlers Discord Client
      │    ├── guildMemberAdd.js      # Sambutan anggota baru (Welcome)
      │    ├── guildMemberRemove.js   # Pesan perpisahan anggota (Goodbye)
      │    ├── interactionCreate.js   # Penanganan Command, Button, Modal, Select
      │    └── ready.js               # Handler saat bot berhasil online
      ├── handlers/            # Auto-loader modular
      │    ├── commandHandler.js      # Pemuat otomatis seluruh slash command
      │    └── eventHandler.js        # Pemuat otomatis seluruh Discord events
      ├── models/              # Schema Mongoose (MongoDB)
      │    ├── GuildConfig.js         # Pengaturan per server
      │    ├── Order.js               # Data transaksi pesanan
      │    ├── Product.js             # Data paket produk & harga
      │    ├── Ticket.js              # Data tiket support
      │    └── User.js                # Data profil & transaksi user
      ├── scripts/             # Script utilitas CLI
      │    ├── deployCommands.js      # Deploy slash commands ke Discord
      │    └── seedProducts.js        # Seeding katalog produk Athi Store
      └── services/            # Logika bisnis & integrasi
           ├── databaseService.js     # Manajemen koneksi & auto-reconnect MongoDB
           ├── storeService.js        # Logika toko, kalkulasi harga, & order
           └── ticketService.js       # Logika tiket, klaim, & log transaksi embed
```

---

## 🛡️ Hak Cipta & Lisensi
Dikembangkan secara profesional untuk **Athi Store**. Seluruh hak cipta dilindungi.
