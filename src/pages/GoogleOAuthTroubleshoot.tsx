import React, { useState } from 'react';
import { Button } from '@/components/ui/enhanced-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle, ExternalLink, Copy, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const GoogleOAuthTroubleshoot: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Kopyalandı",
      description: "URL panoya kopyalandı.",
    });
  };

  const testUrls = {
    prodOrigin: 'https://receipto-tr-rewards.lovable.app',
    prodCallback: 'https://receipto-tr-rewards.lovable.app/auth/callback',
    supabaseCallback: 'https://mxrjsclpdwmrrvmzmqmo.supabase.co/auth/v1/callback',
    localOrigin: 'http://localhost:5173',
    localCallback: 'http://localhost:5173/auth/callback'
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Google OAuth Sorun Giderme</h1>
        <p className="text-muted-foreground">
          "accounts.google.com refused to connect" hatasını çözme rehberi
        </p>
      </div>

      {/* Current Error */}
      <Alert className="border-destructive bg-destructive/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Hata:</strong> "accounts.google.com refused to connect" - Bu hata, Google Cloud Console'da yanlış yapılandırma nedeniyle oluşur.
        </AlertDescription>
      </Alert>

      {/* Quick Fix */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">Hızlı Çözüm</CardTitle>
          <CardDescription>En yaygın çözüm yöntemi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="bg-green-100 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">1. Google Cloud Console'a gidin</h4>
              <Button asChild size="sm" className="mb-2">
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Google Cloud Console Aç
                </a>
              </Button>
              <p className="text-sm text-green-700">
                APIs & Services → Credentials bölümüne gidin
              </p>
            </div>

            <div className="bg-green-100 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">2. OAuth Client ID'nizi bulun ve düzenleyin</h4>
              <p className="text-sm text-green-700 mb-2">
                Web application tipindeki OAuth client ID'nizi bulup "Edit" düğmesine tıklayın
              </p>
            </div>

            <div className="bg-green-100 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">3. Bu URL'leri tam olarak ekleyin</h4>
              
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-sm mb-1">Authorized JavaScript origins:</p>
                  <div className="space-y-1">
                    {[testUrls.prodOrigin, 'https://mxrjsclpdwmrrvmzmqmo.supabase.co', testUrls.localOrigin].map((url) => (
                      <div key={url} className="flex items-center gap-2 bg-white p-2 rounded border">
                        <code className="text-xs flex-1">{url}</code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(url)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-medium text-sm mb-1">Authorized redirect URIs:</p>
                  <div className="space-y-1">
                    {[testUrls.supabaseCallback, testUrls.prodCallback, testUrls.localCallback].map((url) => (
                      <div key={url} className="flex items-center gap-2 bg-white p-2 rounded border">
                        <code className="text-xs flex-1">{url}</code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(url)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-100 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">4. Supabase'de Site URL'i ayarlayın</h4>
              <Button asChild size="sm" className="mb-2">
                <a href="https://supabase.com/dashboard/project/mxrjsclpdwmrrvmzmqmo/auth/url-configuration" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Supabase URL Configuration Aç
                </a>
              </Button>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Site URL:</strong> <code>{testUrls.prodOrigin}</code>
                </div>
                <div>
                  <strong>Redirect URLs:</strong> 
                  <ul className="list-disc ml-4 mt-1">
                    <li><code>{testUrls.prodCallback}</code></li>
                    <li><code>{testUrls.localCallback}</code></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              Detaylı Sorun Giderme
            </Button>
          </CardTitle>
        </CardHeader>
        {showDetails && (
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {/* Common Issues */}
              <div className="space-y-3">
                <h4 className="font-medium">Yaygın Sorunlar ve Çözümleri:</h4>
                
                <div className="border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium">URL'ler tam olarak eşleşmiyor</p>
                      <p className="text-sm text-muted-foreground">
                        Google Cloud Console'daki URL'ler yukarıdaki listede verilen URL'lerle TAM OLARAK aynı olmalı.
                        Sonunda "/" olmasa bile fark yaratabilir.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium">Cache problemi</p>
                      <p className="text-sm text-muted-foreground">
                        Değişiklikleri yaptıktan sonra tarayıcınızı yenileyin ve incognito modda deneyin.
                        Google OAuth ayarlarının aktif olması birkaç dakika sürebilir.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium">Supabase Google provider kapalı</p>
                      <p className="text-sm text-muted-foreground">
                        Supabase Dashboard'da Authentication → Providers bölümünde Google provider'ın enabled olduğunu
                        ve Client ID + Secret'ın doğru girildiğini kontrol edin.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Testing Steps */}
              <div className="space-y-3">
                <h4 className="font-medium">Test Adımları:</h4>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Google Cloud Console OAuth client oluşturuldu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Authorized JavaScript origins doğru URL'lerle ayarlandı</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Authorized redirect URIs doğru URL'lerle ayarlandı</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Supabase'de Google provider enabled ve credentials girildi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Supabase URL Configuration ayarlandı</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Google sign-in test edildi</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Help Links */}
      <div className="flex gap-3 justify-center">
        <Button asChild variant="outline">
          <a href="/google-auth-setup" target="_blank">
            Kurulum Rehberi
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href="https://supabase.com/docs/guides/auth/social-login/auth-google" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Supabase Docs
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href="/auth" target="_blank">
            Auth Sayfasını Test Et
          </a>
        </Button>
      </div>
    </div>
  );
};

export default GoogleOAuthTroubleshoot;