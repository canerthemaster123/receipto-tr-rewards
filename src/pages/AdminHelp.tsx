import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Shield, Users, CheckCircle, BarChart, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminHelp: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Admin Yardım
        </h1>
        <p className="text-muted-foreground mt-2">
          Admin paneli kullanımı ve yetki yönetimi hakkında bilgiler
        </p>
      </div>

      <div className="grid gap-6">
        {/* Admin Panel Access */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Paneline Erişim
            </CardTitle>
            <CardDescription>
              Admin paneline nasıl erişilir ve kimler kullanabilir
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Erişim Adresi:</h4>
              <code className="bg-muted px-2 py-1 rounded text-sm">/admin</code>
              <p className="text-sm text-muted-foreground mt-2">
                Admin paneline doğrudan tarayıcınızın adres çubuğuna <code>/admin</code> yazarak erişebilirsiniz.
              </p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Yetki Gereksinimleri:</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Kullanıcının <code>users_profile.role</code> alanı <code>"admin"</code> olmalıdır</li>
                <li>Yetkisiz kullanıcılar otomatik olarak dashboard sayfasına yönlendirilir</li>
                <li>Admin yetkisi yalnızca Supabase veritabanından manuel olarak verilebilir</li>
              </ul>
            </div>

            <Button 
              onClick={() => navigate('/admin')}
              className="w-fit"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Admin Paneline Git
            </Button>
          </CardContent>
        </Card>

        {/* User Role Management */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-secondary" />
              Kullanıcı Yetki Yönetimi
            </CardTitle>
            <CardDescription>
              Supabase'de kullanıcı yetkilerini nasıl düzenleyebilirsiniz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Supabase Adımları:</h4>
              <ol className="list-decimal list-inside text-sm space-y-2">
                <li>Supabase Dashboard'a giriş yapın</li>
                <li><code>users_profile</code> tablosunu açın</li>
                <li>Yetki vermek istediğiniz kullanıcıyı bulun</li>
                <li><code>role</code> sütununu <code>"admin"</code> olarak güncelleyin</li>
                <li>Değişiklik otomatik olarak uygulanır</li>
              </ol>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Mevcut Roller:</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><code>admin</code> - Tam erişim, tüm işlemleri yapabilir</li>
                <li><code>moderator</code> - Kısıtlı admin erişimi</li>
                <li><code>user</code> - Standart kullanıcı (varsayılan)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Approval */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-accent" />
              Fiş Onaylama Sistemi
            </CardTitle>
            <CardDescription>
              Fişlerin nasıl onaylandığı ve puan sisteminin çalışması
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Onaylama Süreci:</h4>
              <ol className="list-decimal list-inside text-sm space-y-2">
                <li>Kullanıcılar fiş yükler → Status: <code>pending</code></li>
                <li>Admin onaylar → Status: <code>approved</code>, +100 puan</li>
                <li>Admin reddeder → Status: <code>rejected</code>, puan yok</li>
                <li>Onaylanan fişler anında grafiklere yansır</li>
              </ol>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Otomatik İşlemler:</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Onaylama işlemi <code>points_ledger</code> tablosuna kayıt eklenir</li>
                <li>Kullanıcının <code>total_points</code> alanı güncellenir</li>
                <li>Realtime güncellemeler ile anında yansıma</li>
                <li>Admin işlemleri audit log'a kaydedilir</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-warning" />
              Analitikler ve Raporlama
            </CardTitle>
            <CardDescription>
              Harcama analitiği ve grafiklerin veri kaynakları
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Veri Kaynakları:</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Grafikler yalnızca <code>approved</code> statüsündeki fişleri kullanır</li>
                <li>Kullanıcıya özel veriler (RLS ile korunmuş)</li>
                <li>Tarih aralığı filtreleme desteği</li>
                <li>Otomatik para birimi formatı (₺)</li>
              </ul>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Boş Grafik Durumu:</h4>
              <p className="text-sm">
                Eğer grafikler boş görünüyorsa: "Onaylanan fişleriniz görünmüyor. 
                Bir fişi onaylayın ve burası dolsun." mesajı gösterilir.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminHelp;