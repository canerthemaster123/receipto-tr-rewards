import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      dashboard: "Dashboard",
      upload: "Upload Receipt",
      history: "Receipt History",
      rewards: "Rewards",
      admin: "Admin",
      profile: "Profile",
      
      // Auth
      welcomeBack: "Welcome Back",
      createAccount: "Create Account",
      signIn: "Sign In",
      signUp: "Sign Up",
      fullName: "Full Name",
      email: "Email",
      password: "Password",
      signingIn: "Signing In...",
      creatingAccount: "Creating Account...",
      dontHaveAccount: "Don't have an account? Sign up",
      alreadyHaveAccount: "Already have an account? Sign in",
      welcomeBonus: "Welcome to Receipto! You've earned 100 welcome points.",
      
      // Dashboard
      welcomeUser: "Welcome back, {{name}}! 👋",
      readyToEarn: "Ready to turn more receipts into rewards?",
      totalPoints: "Total Points",
      totalReceipts: "Total Receipts",
      thisMonth: "This Month",
      toNextReward: "To Next Reward",
      progressToReward: "Progress to Next Reward",
      earnMorePoints: "Earn {{points}} more points to unlock a ₺20 gift card",
      recentReceipts: "Recent Receipts",
      quickActions: "Quick Actions",
      uploadNewReceipt: "Upload New Receipt",
      earnPointsInstantly: "Earn 100 points instantly",
      browseRewards: "Browse Rewards",
      redeemYourPoints: "Redeem your points",
      setReminders: "Set Reminders",
      neverMissReceipt: "Never miss a receipt",
      
      // Upload
      uploadReceiptTitle: "Upload Receipt",
      uploadReceiptDesc: "Upload your purchase receipt and earn 100 points instantly",
      uploadReceiptImage: "Upload Receipt Image",
      dragDropReceipt: "Drag and drop your receipt image here, or click to browse",
      chooseFile: "Choose File",
      takePhoto: "Take Photo",
      receiptPreview: "Receipt Preview",
      receiptInformation: "Receipt Information",
      storeName: "Store Name",
      purchaseDate: "Purchase Date",
      totalAmount: "Total Amount (₺)",
      items: "Items (Optional)",
      processingReceipt: "Processing...",
      processReceipt: "Process Receipt",
      changeImage: "Change Image",
      readyToSubmit: "Ready to Submit",
      youllEarnPoints: "You'll earn 100 points for this receipt!",
      submitEarnPoints: "Submit & Earn Points",
      submitting: "Submitting...",
      
      // History
      receiptHistory: "Receipt History",
      trackReceipts: "Track all your uploaded receipts and earned points",
      pointsEarned: "Points Earned",
      totalSpent: "Total Spent",
      searchReceipts: "Search receipts by store or items...",
      filter: "Filter",
      approved: "Approved",
      pending: "Pending",
      rejected: "Rejected",
      view: "View",
      download: "Download",
      noReceiptsFound: "No Receipts Found",
      adjustSearchTerms: "Try adjusting your search terms",
      startUploading: "Start uploading receipts to see them here",
      receiptDetails: "Receipt Details",
      close: "Close",
      
      // Rewards
      rewardsTitle: "Rewards Catalog",
      redeemPointsDesc: "Redeem your points for amazing rewards",
      availableRewards: "Available Rewards",
      myRedemptions: "My Redemptions",
      redeem: "Redeem",
      redeemed: "Redeemed",
      
      // Admin
      adminPanel: "Admin Panel",
      manageUsers: "Manage users and review receipts",
      pendingReceipts: "Pending Receipts",
      approve: "Approve",
      reject: "Reject",
      
      // Referral
      inviteFriends: "Invite Friends",
      yourReferralCode: "Your Referral Code",
      shareCode: "Share this code with friends and both get 200 points!",
      copyCode: "Copy Code",
      
      // Language
      language: "Language",
      english: "English",
      turkish: "Turkish"
    }
  },
  tr: {
    translation: {
      // Navigation
      dashboard: "Ana Sayfa",
      upload: "Fiş Yükle",
      history: "Fiş Geçmişi",
      rewards: "Ödüller",
      admin: "Yönetici",
      profile: "Profil",
      
      // Auth
      welcomeBack: "Tekrar Hoş Geldiniz",
      createAccount: "Hesap Oluştur",
      signIn: "Giriş Yap",
      signUp: "Kayıt Ol",
      fullName: "Ad Soyad",
      email: "E-posta",
      password: "Şifre",
      signingIn: "Giriş yapılıyor...",
      creatingAccount: "Hesap oluşturuluyor...",
      dontHaveAccount: "Hesabınız yok mu? Kayıt olun",
      alreadyHaveAccount: "Zaten hesabınız var mı? Giriş yapın",
      welcomeBonus: "Receipto'ya hoş geldiniz! 100 hoş geldin puanı kazandınız.",
      
      // Dashboard
      welcomeUser: "Tekrar hoş geldin, {{name}}! 👋",
      readyToEarn: "Daha fazla fişi ödüle dönüştürmeye hazır mısın?",
      totalPoints: "Toplam Puan",
      totalReceipts: "Toplam Fiş",
      thisMonth: "Bu Ay",
      toNextReward: "Sonraki Ödüle",
      progressToReward: "Sonraki Ödül İlerlemesi",
      earnMorePoints: "₺20 hediye kartı kazanmak için {{points}} puan daha kazanın",
      recentReceipts: "Son Fişler",
      quickActions: "Hızlı İşlemler",
      uploadNewReceipt: "Yeni Fiş Yükle",
      earnPointsInstantly: "Anında 100 puan kazan",
      browseRewards: "Ödüllere Göz At",
      redeemYourPoints: "Puanlarınızı kullanın",
      setReminders: "Hatırlatıcı Kur",
      neverMissReceipt: "Hiç fiş kaçırma",
      
      // Upload
      uploadReceiptTitle: "Fiş Yükle",
      uploadReceiptDesc: "Alışveriş fişinizi yükleyin ve anında 100 puan kazanın",
      uploadReceiptImage: "Fiş Resmi Yükle",
      dragDropReceipt: "Fiş resmini buraya sürükleyip bırakın veya dosya seçmek için tıklayın",
      chooseFile: "Dosya Seç",
      takePhoto: "Fotoğraf Çek",
      receiptPreview: "Fiş Önizlemesi",
      receiptInformation: "Fiş Bilgileri",
      storeName: "Mağaza Adı",
      purchaseDate: "Alışveriş Tarihi",
      totalAmount: "Toplam Tutar (₺)",
      items: "Ürünler (İsteğe Bağlı)",
      processingReceipt: "İşleniyor...",
      processReceipt: "Fişi İşle",
      changeImage: "Resmi Değiştir",
      readyToSubmit: "Gönderime Hazır",
      youllEarnPoints: "Bu fiş için 100 puan kazanacaksınız!",
      submitEarnPoints: "Gönder ve Puan Kazan",
      submitting: "Gönderiliyor...",
      
      // History
      receiptHistory: "Fiş Geçmişi",
      trackReceipts: "Yüklediğiniz tüm fişleri ve kazandığınız puanları takip edin",
      pointsEarned: "Kazanılan Puan",
      totalSpent: "Toplam Harcama",
      searchReceipts: "Mağaza veya ürünlere göre fiş arayın...",
      filter: "Filtrele",
      approved: "Onaylandı",
      pending: "Beklemede",
      rejected: "Reddedildi",
      view: "Görüntüle",
      download: "İndir",
      noReceiptsFound: "Fiş Bulunamadı",
      adjustSearchTerms: "Arama terimlerinizi ayarlamayı deneyin",
      startUploading: "Burada görmek için fiş yüklemeye başlayın",
      receiptDetails: "Fiş Detayları",
      close: "Kapat",
      
      // Rewards
      rewardsTitle: "Ödül Kataloğu",
      redeemPointsDesc: "Puanlarınızı harika ödüllerle değiştirin",
      availableRewards: "Mevcut Ödüller",
      myRedemptions: "Kullandığım Ödüller",
      redeem: "Kullan",
      redeemed: "Kullanıldı",
      
      // Admin
      adminPanel: "Yönetici Paneli",
      manageUsers: "Kullanıcıları yönet ve fişleri incele",
      pendingReceipts: "Bekleyen Fişler",
      approve: "Onayla",
      reject: "Reddet",
      
      // Referral
      inviteFriends: "Arkadaş Davet Et",
      yourReferralCode: "Referans Kodunuz",
      shareCode: "Bu kodu arkadaşlarınızla paylaşın, ikiniz de 200 puan kazanın!",
      copyCode: "Kodu Kopyala",
      
      // Language
      language: "Dil",
      english: "İngilizce",
      turkish: "Türkçe"
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
      escapeValue: false
    }
  });

export default i18n;