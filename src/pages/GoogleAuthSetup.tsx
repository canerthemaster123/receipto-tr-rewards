import React from 'react';
import { Button } from '@/components/ui/enhanced-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ExternalLink, Settings, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const GoogleAuthSetup: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Google Authentication Setup</h1>
        <p className="text-muted-foreground">Configure Google OAuth for your Receipto application</p>
      </div>

      {/* Current Status */}
      <Alert className="border-warning bg-warning/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Google authentication is not configured.</strong> Follow the steps below to enable Google sign-in/sign-up functionality.
        </AlertDescription>
      </Alert>

      {/* Setup Steps */}
      <div className="grid gap-6">
        {/* Step 1: Google Cloud Console */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Google Cloud Console Setup
            </CardTitle>
            <CardDescription>Configure OAuth 2.0 credentials in Google Cloud Console</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Steps:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                <li>Create a new project or select existing project</li>
                <li>Navigate to APIs & Services → Credentials</li>
                <li>Click "Create Credentials" → "OAuth client ID"</li>
                <li>Choose "Web application"</li>
              </ul>
            </div>
            
            <div className="bg-muted p-4 rounded-lg">
              <h5 className="font-medium mb-2">Required URLs:</h5>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Authorized JavaScript origins:</strong>
                  <code className="block bg-background p-2 rounded mt-1">
                    https://mxrjsclpdwmrrvmzmqmo.supabase.co<br/>
                    http://localhost:5173<br/>
                    [Your production domain]
                  </code>
                </div>
                <div>
                  <strong>Authorized redirect URIs:</strong>
                  <code className="block bg-background p-2 rounded mt-1">
                    https://mxrjsclpdwmrrvmzmqmo.supabase.co/auth/v1/callback<br/>
                    http://localhost:5173/auth/callback<br/>
                    [Your production domain]/auth/callback
                  </code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Supabase Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Supabase Dashboard Configuration
            </CardTitle>
            <CardDescription>Enable Google provider in Supabase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Steps:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li>Go to <a href="https://supabase.com/dashboard/project/mxrjsclpdwmrrvmzmqmo" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Supabase Dashboard</a></li>
                <li>Navigate to Authentication → Providers</li>
                <li>Find "Google" provider and enable it</li>
                <li>Enter your Client ID and Client Secret from Google Cloud Console</li>
                <li>Save the configuration</li>
              </ul>
            </div>

            <Button asChild className="w-full">
              <a href="https://supabase.com/dashboard/project/mxrjsclpdwmrrvmzmqmo/auth/providers" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Supabase Auth Providers
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Step 3: URL Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              URL Configuration
            </CardTitle>
            <CardDescription>Configure site URL and redirect URLs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Steps:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li>In Supabase Dashboard, go to Authentication → URL Configuration</li>
                <li>Set Site URL to your application's main URL</li>
                <li>Add redirect URLs for different environments</li>
              </ul>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h5 className="font-medium mb-2">Configuration:</h5>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Site URL:</strong>
                  <code className="block bg-background p-2 rounded mt-1">
                    http://localhost:5173 (development)<br/>
                    [Your production domain] (production)
                  </code>
                </div>
                <div>
                  <strong>Redirect URLs:</strong>
                  <code className="block bg-background p-2 rounded mt-1">
                    http://localhost:5173/auth/callback<br/>
                    [Your production domain]/auth/callback
                  </code>
                </div>
              </div>
            </div>

            <Button asChild className="w-full" variant="outline">
              <a href="https://supabase.com/dashboard/project/mxrjsclpdwmrrvmzmqmo/auth/url-configuration" target="_blank" rel="noopener noreferrer">
                <Settings className="h-4 w-4 mr-2" />
                Open URL Configuration
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              Testing
            </CardTitle>
            <CardDescription>Verify the Google authentication works</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Checklist:</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    Google Cloud OAuth client configured
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    Supabase Google provider enabled with credentials
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    Site URL and Redirect URLs configured
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    Test Google sign-in flow
                  </div>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  Once configured, the Google sign-in button on the authentication page will work seamlessly for both sign-up and sign-in flows.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help */}
      <Card className="border-muted">
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            If you encounter issues during setup, check the browser console for specific error messages or verify that all URLs match exactly (including trailing slashes).
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="https://supabase.com/docs/guides/auth/social-login/auth-google" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Supabase Docs
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="https://developers.google.com/identity/oauth2/web/guides/overview" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Google OAuth Docs
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleAuthSetup;