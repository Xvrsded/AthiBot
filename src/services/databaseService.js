const mongoose = require('mongoose');

/**
 * Service Manajemen Koneksi MongoDB
 * Menggunakan Mongoose dengan auto-reconnect dan mekanisme error handling yang aman
 * agar bot tidak crash saat koneksi database terputus.
 */
class DatabaseService {
  constructor() {
    this.isConnected = false;
    this.reconnectTimer = null;
    this.setupListeners();
  }

  setupListeners() {
    mongoose.set('strictQuery', false);

    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      console.log('✅ [MongoDB] Berhasil terhubung ke database.');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    mongoose.connection.on('error', (err) => {
      this.isConnected = false;
      console.error('❌ [MongoDB] Error koneksi:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      console.warn('⚠️ [MongoDB] Koneksi terputus! Mencoba menghubungkan kembali dalam 5 detik...');
      this.scheduleReconnect();
    });
  }

  /**
   * Menghubungkan ke MongoDB
   * @param {string} [uri] URI koneksi MongoDB
   */
  async connect(uri = process.env.MONGO_URI) {
    if (!uri) {
      console.warn('⚠️ [MongoDB] MONGO_URI tidak ditemukan di .env! Berjalan tanpa koneksi database.');
      return;
    }

    if (mongoose.connection.readyState === 1) {
      this.isConnected = true;
      return;
    }

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      console.error('❌ [MongoDB] Gagal melakukan inisialisasi koneksi awal:', error.message);
      this.scheduleReconnect(uri);
    }
  }

  /**
   * Jadwalkan percobaan koneksi ulang
   * @param {string} [uri]
   */
  scheduleReconnect(uri = process.env.MONGO_URI) {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(uri);
    }, 5000);
  }

  /**
   * Mendapatkan latensi (ping) koneksi database dalam milidetik
   * @returns {Promise<number>} Latensi dalam ms, atau -1 jika terputus
   */
  async getDbPing() {
    if (mongoose.connection.readyState !== 1) return -1;
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      return Date.now() - start;
    } catch {
      return -1;
    }
  }

  /**
   * Cek status koneksi aktif
   * @returns {boolean}
   */
  get ready() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new DatabaseService();

