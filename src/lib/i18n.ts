import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      'nav.dashboard': 'Dashboard',
      'nav.upload': 'Upload Receipt',
      'nav.history': 'History',
      'nav.rewards': 'Rewards',
      'nav.admin': 'Admin',
      'nav.brand': 'Brand Analytics',
      'nav.logout': 'Logout',
      
      // Auth
      'auth.title': 'Welcome to Receipto',
      'auth.subtitle': 'Upload receipts, earn rewards!',
      'auth.login': 'Login',
      'auth.signup': 'Sign Up',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.name': 'Full Name',
      'auth.referralCode': 'Referral Code (Optional)',
      'auth.loginLink': 'Already have an account? Login',
      'auth.signupLink': "Don't have an account? Sign up",
      'auth.loading': 'Please wait...',
      
      // Dashboard
      'dashboard.title': 'Welcome back',
      'dashboard.totalPoints': 'Total Points',
      'dashboard.receiptsUploaded': 'Receipts Uploaded',
      'dashboard.recentActivity': 'Recent Activity',
      'dashboard.uploadReceipt': 'Upload Receipt',
      'dashboard.viewRewards': 'View Rewards',
      'dashboard.inviteFriends': 'Invite Friends',
      'dashboard.yourReferralCode': 'Your Referral Code',
      'dashboard.copyCode': 'Copy Code',
      'dashboard.codeCopied': 'Code copied!',
      
      // Upload
      'upload.title': 'Upload Receipt',
      'upload.subtitle': 'Upload your purchase receipt and earn 100 points instantly',
      'upload.dragDrop': 'Drag and drop your receipt image here, or click to browse',
      'upload.chooseFile': 'Choose File',
      'upload.takePhoto': 'Take Photo',
      'upload.processing': 'Processing...',
      'upload.processReceipt': 'Process Receipt',
      'upload.storeName': 'Store Name',
      'upload.purchaseDate': 'Purchase Date',
      'upload.totalAmount': 'Total Amount',
      'upload.items': 'Items (Optional)',
      'upload.submit': 'Submit & Earn Points',
      'upload.submitting': 'Submitting...',
      
      // History
      'history.title': 'Receipt History',
      'history.subtitle': 'View all your uploaded receipts and earnings',
      'history.noReceipts': 'No receipts uploaded yet',
      'history.startUploading': 'Start uploading receipts to earn points!',
      'history.uploadFirst': 'Upload First Receipt',
      
      // Rewards
      'rewards.title': 'Rewards Catalog',
      'rewards.subtitle': 'Redeem your points for amazing rewards',
      'rewards.points': 'points',
      'rewards.redeem': 'Redeem',
      'rewards.insufficient': 'Insufficient Points',
      
      // Messages
      'message.loginSuccess': 'Welcome back!',
      'message.signupSuccess': 'Account created successfully!',
      'message.receiptProcessed': 'Receipt processed successfully!',
      'message.receiptSubmitted': 'Receipt submitted! You earned {{points}} points!',
      'message.rewardRedeemed': 'Reward redeemed successfully!',
      'message.referralProcessed': 'Referral processed! You both earned 200 points!',
      'message.error': 'Something went wrong. Please try again.',
      'message.invalidCredentials': 'Invalid email or password',
      'message.missingFields': 'Please fill in all required fields',
      
      // Admin
      'admin.title': 'Admin Panel',
      'admin.pendingReceipts': 'Pending Receipts',
      'admin.users': 'Users',
      'admin.analytics': 'Analytics',
      'admin.approve': 'Approve',
      'admin.reject': 'Reject',
      'admin.viewDetails': 'View Details',
      
      // Brand
      'brand.title': 'Brand Analytics',
      'brand.subtitle': 'Insights from receipt data',
      'brand.totalReceipts': 'Total Receipts',
      'brand.averageBasket': 'Average Basket Size',
      'brand.topMerchants': 'Top Merchants',
      
      // Common
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.close': 'Close',
      'common.view': 'View',
      'common.edit': 'Edit',
      'common.delete': 'Delete',
      'common.language': 'Language'
    }
  },
  tr: {
    translation: {
      // Navigation
      'nav.dashboard': 'Kontrol Paneli',
      'nav.upload': 'Fiş Yükle',
      'nav.history': 'Geçmiş',
      'nav.rewards': 'Ödüller',
      'nav.admin': 'Yönetici',
      'nav.brand': 'Marka Analitikleri',
      'nav.logout': 'Çıkış',
      
      // Auth
      'auth.title': "Receipto'ya Hoş Geldiniz",
      'auth.subtitle': 'Fiş yükleyin, ödül kazanın!',
      'auth.login': 'Giriş Yap',
      'auth.signup': 'Kaydol',
      'auth.email': 'E-posta',
      'auth.password': 'Şifre',
      'auth.name': 'Ad Soyad',
      'auth.referralCode': 'Davet Kodu (İsteğe Bağlı)',
      'auth.loginLink': 'Hesabınız var mı? Giriş yapın',
      'auth.signupLink': 'Hesabınız yok mu? Kaydolun',
      'auth.loading': 'Lütfen bekleyin...',
      
      // Dashboard
      'dashboard.title': 'Tekrar hoş geldiniz',
      'dashboard.totalPoints': 'Toplam Puan',
      'dashboard.receiptsUploaded': 'Yüklenen Fişler',
      'dashboard.recentActivity': 'Son Aktiviteler',
      'dashboard.uploadReceipt': 'Fiş Yükle',
      'dashboard.viewRewards': 'Ödülleri Gör',
      'dashboard.inviteFriends': 'Arkadaş Davet Et',
      'dashboard.yourReferralCode': 'Davet Kodunuz',
      'dashboard.copyCode': 'Kodu Kopyala',
      'dashboard.codeCopied': 'Kod kopyalandı!',
      
      // Upload
      'upload.title': 'Fiş Yükle',
      'upload.subtitle': 'Alışveriş fişinizi yükleyin ve anında 100 puan kazanın',
      'upload.dragDrop': 'Fiş görselinizi buraya sürükleyip bırakın veya dosya seçmek için tıklayın',
      'upload.chooseFile': 'Dosya Seç',
      'upload.takePhoto': 'Fotoğraf Çek',
      'upload.processing': 'İşleniyor...',
      'upload.processReceipt': 'Fişi İşle',
      'upload.storeName': 'Mağaza Adı',
      'upload.purchaseDate': 'Alışveriş Tarihi',
      'upload.totalAmount': 'Toplam Tutar (₺)',
      'upload.items': 'Ürünler (İsteğe Bağlı)',
      'upload.submit': 'Gönder ve Puan Kazan',
      'upload.submitting': 'Gönderiliyor...',
      
      // History
      'history.title': 'Fiş Geçmişi',
      'history.subtitle': 'Yüklediğiniz tüm fişleri ve kazançlarınızı görüntüleyin',
      'history.noReceipts': 'Henüz fiş yüklenmemiş',
      'history.startUploading': 'Puan kazanmak için fiş yüklemeye başlayın!',
      'history.uploadFirst': 'İlk Fişi Yükle',
      
      // Rewards
      'rewards.title': 'Ödül Kataloğu',
      'rewards.subtitle': 'Puanlarınızı harika ödüllerle değiştirin',
      'rewards.points': 'puan',
      'rewards.redeem': 'Kullan',
      'rewards.insufficient': 'Yetersiz Puan',
      
      // Messages
      'message.loginSuccess': 'Tekrar hoş geldiniz!',
      'message.signupSuccess': 'Hesap başarıyla oluşturuldu!',
      'message.receiptProcessed': 'Fiş başarıyla işlendi!',
      'message.receiptSubmitted': 'Fiş gönderildi! {{points}} puan kazandınız!',
      'message.rewardRedeemed': 'Ödül başarıyla kullanıldı!',
      'message.referralProcessed': 'Davet işlendi! İkiniz de 200 puan kazandınız!',
      'message.error': 'Bir şeyler yanlış gitti. Lütfen tekrar deneyin.',
      'message.invalidCredentials': 'Geçersiz e-posta veya şifre',
      'message.missingFields': 'Lütfen tüm gerekli alanları doldurun',
      
      // Admin
      'admin.title': 'Yönetici Paneli',
      'admin.pendingReceipts': 'Bekleyen Fişler',
      'admin.users': 'Kullanıcılar',
      'admin.analytics': 'Analitikler',
      'admin.approve': 'Onayla',
      'admin.reject': 'Reddet',
      'admin.viewDetails': 'Detayları Gör',
      
      // Brand
      'brand.title': 'Marka Analitikleri',
      'brand.subtitle': 'Fiş verilerinden elde edilen içgörüler',
      'brand.totalReceipts': 'Toplam Fiş',
      'brand.averageBasket': 'Ortalama Sepet Büyüklüğü',
      'brand.topMerchants': 'En Çok Tercih Edilen Mağazalar',
      
      // Common
      'common.loading': 'Yükleniyor...',
      'common.error': 'Hata',
      'common.success': 'Başarılı',
      'common.cancel': 'İptal',
      'common.save': 'Kaydet',
      'common.close': 'Kapat',
      'common.view': 'Görüntüle',
      'common.edit': 'Düzenle',
      'common.delete': 'Sil',
      'common.language': 'Dil'
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;