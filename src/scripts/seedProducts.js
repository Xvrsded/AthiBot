require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

/**
 * Script Seeding Database Produk Athi Store
 * Mengisi database MongoDB dengan pricelist resmi Athi Store:
 * 1. ROBUX VIA USERNAME (12 paket)
 * 2. ROBUX VILOG (7 paket)
 */
async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI tidak ditemukan di .env! Pastikan sudah diatur.');
    process.exit(1);
  }

  try {
    console.log('🍃 Menghubungkan ke MongoDB untuk seeding produk...');
    await mongoose.connect(uri);
    console.log('✅ Terhubung ke database.');

    // 1. Data Paket Robux Via Username
    const usernameProducts = [
      { name: '25 Robux (Username)', amount: 25, price: 5000 },
      { name: '50 Robux (Username)', amount: 50, price: 9000 },
      { name: '100 Robux (Username)', amount: 100, price: 15600 },
      { name: '200 Robux (Username)', amount: 200, price: 31200 },
      { name: '300 Robux (Username)', amount: 300, price: 46800 },
      { name: '400 Robux (Username)', amount: 400, price: 62400 },
      { name: '500 Robux (Username)', amount: 500, price: 78000 },
      { name: '600 Robux (Username)', amount: 600, price: 93600 },
      { name: '700 Robux (Username)', amount: 700, price: 109200 },
      { name: '800 Robux (Username)', amount: 800, price: 124800 },
      { name: '900 Robux (Username)', amount: 900, price: 140400 },
      { name: '1000 Robux (Username)', amount: 1000, price: 156000 }
    ].map((item, index) => ({
      ...item,
      category: 'ROBUX VIA USERNAME',
      unit: 'Robux',
      description: 'Langsung masuk, syarat akun 18+ / KTP & 2-Step Verification',
      isActive: true,
      sortOrder: index + 1
    }));

    // 2. Data Paket Robux Vilog
    const vilogProducts = [
      { name: '80 ROBUX (Vilog)', amount: 80, price: 16000 },
      { name: '160 ROBUX (Vilog)', amount: 160, price: 32000 },
      { name: '240 ROBUX (Vilog)', amount: 240, price: 48000 },
      { name: '320 ROBUX (Vilog)', amount: 320, price: 64000 },
      { name: '500 ROBUX (Vilog)', amount: 500, price: 78500 },
      { name: '1000 ROBUX (Vilog)', amount: 1000, price: 157000 },
      { name: '1500 ROBUX (Vilog)', amount: 1500, price: 235500 }
    ].map((item, index) => ({
      ...item,
      category: 'ROBUX VILOG',
      unit: 'Robux',
      description: 'Proses kilat 1–15 menit, no limit bebas beli berapa saja',
      isActive: true,
      sortOrder: index + 1
    }));

    const allProducts = [...usernameProducts, ...vilogProducts];

    // Hapus data lama dan masukkan data baru
    console.log('🧹 Membersihkan koleksi produk lama...');
    await Product.deleteMany({});

    console.log(`📥 Memasukkan ${allProducts.length} produk resmi Athi Store...`);
    const inserted = await Product.insertMany(allProducts);

    console.log(`✅ Berhasil memasukkan ${inserted.length} produk ke MongoDB!`);
    console.log('==================================================');
    console.log('🍑 Paket Username : 12 produk (25r s/d 1000r)');
    console.log('🍑 Paket Vilog    : 7 produk (80r s/d 1500r)');
    console.log('==================================================');

    await mongoose.disconnect();
    console.log('🔌 Koneksi database ditutup.');
  } catch (error) {
    console.error('❌ Gagal menjalankan seeding produk:', error);
    process.exit(1);
  }
}

seed();
