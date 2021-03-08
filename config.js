module.exports = {
  port: process.env.PORT || 3000,

  // used by /api/admin/export and /api/admin/reset
  adminKey: 'shopledger-admin-2021',

  shop: {
    name: 'Corner Shop Kirana & Wholesale',
    tagline: 'Est. 1998 • FMCG, Staples & Bulk Provisions',
    address: '14 Market Road, Sadashiv Peth, Pune 411030',
    phone: '+91 20 2447 8910',
    gstin: '27AAAAA0000A1Z5',
    stateCode: '27 (Maharashtra)'
  },

  tax: {
    // Fallback rate used before HSN slab migration (Jul 2021)
    defaultRate: 0.18,
    // HSN prefix to GST percentage mapping
    hsnSlabs: {
      '1006': 5,   // Rice & grains
      '0713': 5,   // Pulses & dal
      '1104': 5,   // Poha & flattened grains
      '1512': 5,   // Edible sunflower oil
      '1508': 5,   // Groundnut oil
      '1701': 5,   // Cane jaggery
      '0405': 12,  // Ghee & table butter
      '0904': 12,  // Spices & chilli powder
      '0902': 18,  // Packaged tea
      '0901': 18,  // Coffee blends
      '2106': 18   // Syrups & concentrates
    }
  },

  inventory: {
    defaultReorderLevel: 10,
    allowBackorder: false
  },

  // Note: Vikram moved extended coupon validation rules to lib/coupons.js
  // Kept here for backward compatibility with older scripts
  coupons: {
    SAVE10: {
      type: 'percent',
      value: 10,
      minOrder: 500,
      maxDiscount: 150,
      active: true,
      description: '10% off on orders above ₹500 (max ₹150)'
    },
    FLAT50: {
      type: 'flat',
      value: 50,
      minOrder: 300,
      maxDiscount: 50,
      active: true,
      description: 'Flat ₹50 off on orders above ₹300'
    },
    WELCOME: {
      type: 'percent',
      value: 5,
      minOrder: 0,
      maxDiscount: 100,
      active: true,
      description: '5% welcome discount (up to ₹100)'
    },
    WHOLESALE15: {
      type: 'percent',
      value: 15,
      minOrder: 2000,
      maxDiscount: 400,
      active: true,
      description: '15% off bulk orders above ₹2,000 (max ₹400)'
    },
    DIWALI20: {
      type: 'percent',
      value: 20,
      minOrder: 1000,
      maxDiscount: 250,
      active: false,
      description: 'Expired festive promo'
    }
  }
};
