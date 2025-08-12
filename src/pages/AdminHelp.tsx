import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Users, Receipt, Settings } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export default function AdminHelp() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Erişim Reddedildi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Bu sayfaya erişim için admin yetkisi gereklidir.
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate('/dashboard')}
                className="mt-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard'a Dön
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/profile')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Profil'e Dön
          </Button>
          <h1 className="text-3xl font-bold">Admin Rehberi</h1>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Admin Paneline Erişim
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Admin paneline erişmek için aşağıdaki adımları takip edin:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Hesabınızın admin rolüne sahip olduğundan emin olun</li>
                <li>Profil sayfanızdan "Admin Panel" linkine tıklayın</li>
                <li>Veya doğrudan <code>/admin</code> adresine gidin</li>
              </ol>
              <Button 
                onClick={() => navigate('/admin')}
                className="w-full sm:w-auto"
              >
                Admin Panel'e Git
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Fiş Onaylama Süreci
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Kullanıcılar tarafından yüklenen fişleri onaylamak için:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Admin panelinde "Bekleyen" durumundaki fişleri görüntüleyin</li>
                <li>Fiş detaylarını incelemek için "Görüntüle" butonuna tıklayın</li>
                <li>Fiş geçerliyse "Onayla" butonuna tıklayın (otomatik +100 puan)</li>
                <li>Fiş geçersizse "Reddet" butonuna tıklayın</li>
                <li>Onaylanan fişler kullanıcının puan bakiyesine otomatik eklenir</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Kullanıcı Yönetimi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Admin olarak yapabileceğiniz işlemler:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Tüm kullanıcıların fiş geçmişini görüntüleme</li>
                <li>Bekleyen, onaylanmış ve reddedilen fişleri filtreleme</li>
                <li>Kullanıcı puan bakiyelerini görüntüleme</li>
                <li>Toplu onaylama ve reddetme işlemleri</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Sistem Ayarları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Geliştirme ortamında kullanılabilecek özellikler:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Test verilerini sıfırlama</li>
                <li>Sahte OCR modunu etkinleştirme</li>
                <li>Admin yetkisi verme (@e2e.local hesapları için)</li>
                <li>Gerçek zamanlı bildirimler</li>
              </ul>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Not:</strong> Geliştirme özellikleri sadece test hesapları (@e2e.local) 
                  için kullanılabilir ve üretim ortamında otomatik olarak devre dışı kalır.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}