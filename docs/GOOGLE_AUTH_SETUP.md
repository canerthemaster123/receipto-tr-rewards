# Google OAuth Setup for Receipto

## Current Status
Google authentication is implemented in the frontend but requires proper configuration in the Supabase dashboard to function.

## Setup Instructions

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API (if not already enabled)

### 2. OAuth 2.0 Client Configuration

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application**
4. Configure the following:

**Authorized JavaScript origins:**
- `https://mxrjsclpdwmrrvmzmqmo.supabase.co` (your Supabase project URL)
- `http://localhost:5173` (for local development)
- Your production domain (if deployed)

**Authorized redirect URIs:**
- `https://mxrjsclpdwmrrvmzmqmo.supabase.co/auth/v1/callback`
- `http://localhost:5173/auth/callback` (for local development)
- Your production domain callback URL

5. Save and copy your **Client ID** and **Client Secret**

### 3. Supabase Configuration

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/mxrjsclpdwmrrvmzmqmo)
2. Navigate to **Authentication** > **Providers**
3. Find **Google** provider and enable it
4. Enter your Google OAuth credentials:
   - **Client ID**: (from Google Cloud Console)
   - **Client Secret**: (from Google Cloud Console)
5. Save the configuration

### 4. URL Configuration

In Supabase Dashboard > **Authentication** > **URL Configuration**:

**Site URL:** Your main application URL
- Production: `https://your-domain.com`
- Development: `http://localhost:5173`

**Redirect URLs:** Add the following URLs:
- `https://your-domain.com/auth/callback`
- `http://localhost:5173/auth/callback`

### 5. Testing

After configuration:

1. The Google sign-in button should work without errors
2. Users should be able to sign up and sign in with Google
3. User profiles should be automatically created
4. The `AuthCallback` component should handle the OAuth flow

### Error Messages

If you see these errors, it means OAuth is not configured:

- "Google Giriş Yapılandırması Gerekli" 
- "provider is not enabled"
- "OAuth provider not configured"

### Production Checklist

- [ ] Google Cloud Console OAuth client configured
- [ ] Supabase Google provider enabled with valid credentials
- [ ] Site URL and Redirect URLs properly configured
- [ ] Test Google sign-in flow end-to-end
- [ ] Verify user profile creation works with Google OAuth

### Local Development

For local development, make sure:
1. `http://localhost:5173` is in authorized origins
2. `http://localhost:5173/auth/callback` is in redirect URIs
3. Site URL in Supabase is set to `http://localhost:5173`

### Support

If you encounter issues:
1. Check browser console for specific error messages
2. Verify all URLs match exactly (including trailing slashes)
3. Ensure Google Cloud project has proper permissions
4. Test with incognito mode to avoid cache issues