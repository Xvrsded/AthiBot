const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

/**
 * Service Toko Athi Store
 * Menangani logika transaksi, katalog produk, kalkulasi harga, dan pembaruan pesanan.
 */
class StoreService {
  /**
   * Format angka ke mata uang Rupiah (contoh: Rp 16.500)
   * @param {number} amount
   * @returns {string}
   */
  formatRupiah(amount) {
    if (typeof amount !== 'number') amount = Number(amount) || 0;
    return 'Rp ' + amount.toLocaleString('id-ID');
  }

  /**
   * Dapatkan semua produk aktif berdasarkan kategori (atau semua jika tidak ditentukan)
   * @param {string} [category]
   * @returns {Promise<Array>}
   */
  async getProducts(category = null) {
    const query = { isActive: true };
    if (category) {
      query.category = category;
    }
    return await Product.find(query).sort({ category: 1, sortOrder: 1, amount: 1 });
  }

  /**
   * Ambil produk berdasarkan ID
   * @param {string} productId
   * @returns {Promise<Object|null>}
   */
  async getProductById(productId) {
    return await Product.findById(productId);
  }

  /**
   * Buat ID Pesanan unik yang profesional
   * @returns {string} Contoh: ATHI-83921
   */
  generateOrderId() {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `ATHI-${randomNum}`;
  }

  /**
   * Buat pesanan baru
   * @param {Object} param0
   * @returns {Promise<Object>}
   */
  async createOrder({ userId, userTag, productId, quantity = 1, robloxUsername, contactInfo = '-', notes = '-' }) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Produk tidak ditemukan atau sudah tidak aktif.');
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const totalPrice = product.price * qty;
    const orderId = this.generateOrderId();

    const order = await Order.create({
      orderId,
      userId,
      userTag,
      productId: product._id,
      productName: product.name,
      category: product.category,
      quantity: qty,
      totalPrice,
      robloxUsername,
      contactInfo,
      notes,
      status: 'PENDING'
    });

    // Perbarui profil user jika ada
    await User.findOneAndUpdate(
      { userId },
      {
        $set: { userTag, robloxUsername },
        $inc: { totalOrders: 1 }
      },
      { upsert: true, new: true }
    );

    return order;
  }

  /**
   * Perbarui status pesanan oleh staff
   * @param {string} orderId
   * @param {string} status 'ACCEPTED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
   * @param {Object} staffUser Objek Discord User dari staff
   * @param {string} [reason] Alasan penolakan / catatan tambahan
   */
  async updateOrderStatus(orderId, status, staffUser, reason = null) {
    const order = await Order.findOne({ orderId });
    if (!order) {
      throw new Error(`Pesanan dengan ID ${orderId} tidak ditemukan.`);
    }

    order.status = status;
    order.handledBy = staffUser ? staffUser.id : null;
    order.handledByName = staffUser ? staffUser.tag || staffUser.username : null;
    if (reason) {
      order.rejectionReason = reason;
    }

    await order.save();

    // Jika COMPLETED, tambahkan totalSpent ke user
    if (status === 'COMPLETED') {
      await User.findOneAndUpdate(
        { userId: order.userId },
        { $inc: { totalSpent: order.totalPrice } }
      );
    }

    return order;
  }
}

module.exports = new StoreService();

