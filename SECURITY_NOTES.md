# Security Notes - Receipt Rewards App

## Overview
This document captures our security decisions and configuration for the Receipt Rewards application.

## Database Security

### Row Level Security (RLS) Strategy
- **Default Policy**: Owner-only access for all user data tables
- **Admin Escalation**: Admins can access/modify data via `has_admin()` function
- **Tables with RLS**:
  - `users_profile` - Users see their own profile; admins see all
  - `receipts` - Users see/modify own receipts; admins can approve/reject
  - `points_ledger` - Read-only for users; write-only via secure RPCs
  - `redemptions` - Owner-only access
  - `audit_log` - Admin-only access
  - `request_throttle` - Admin-only visibility

### Secure Write Operations
All sensitive writes flow through Security Definer RPCs:
- `apply_referral_bonus()` - Handles referral code applications with validation
- `approve_receipt_with_points()` - Admin-only receipt approval
- `reject_receipt_with_reason()` - Admin-only receipt rejection
- `secure_upload_check()` - Pre-upload validation with rate limiting

### Rate Limiting
- **Receipt uploads**: 5 per 10 seconds per user
- **Referral applications**: 3 per 60 seconds per user  
- **Admin approvals/rejections**: 20 per 10 seconds per admin
- **Storage**: File size limited to 5MB

### Audit Logging
Triggers capture all changes to sensitive tables:
- `receipts`, `points_ledger`, `users_profile`, `user_roles`
- Records: actor, action, before/after state, timestamp

## Storage Security
- **Bucket**: `receipts` (private)
- **Path Structure**: `user_id/filename` enforced by RLS policies
- **Access**: Users can only access their own files; admins can read all
- **File Restrictions**: 5MB max size, path length < 200 chars

## Authentication Settings
Settings configured in Supabase Dashboard → Authentication:

### Current Settings (to be updated by user)
- **OTP Expiry**: ⚠️ Currently > 1 hour (needs reduction to 10-30 minutes)
- **Leaked Password Protection**: ⚠️ Currently disabled (needs enabling)
- **Password Policy**: Strong (8+ chars, complexity required)

### Required Manual Configuration
1. Go to Supabase Dashboard → Authentication → Settings
2. Set **Email OTP token expiry** to 15 minutes
3. Enable **Leaked password protection** (Have I Been Pwned integration)
4. Verify **Password strength** is set to "Strong"

## CORS & CSP Configuration

### Allowed Origins (Edge Functions)
- `https://receipto-tr-rewards.lovable.app` (production)
- `http://localhost:5173` (development)
- `http://localhost:3000` (alternative dev)

### Content Security Policy
```
default-src 'self';
script-src 'self';
img-src 'self' data: blob:;
style-src 'self' 'unsafe-inline';
connect-src 'self' https://*.supabase.co https://receipto-tr-rewards.lovable.app;
frame-ancestors 'none';
base-uri 'self';
```

## Extensions & Schema
- **Extensions Schema**: All extensions moved to `extensions` schema (not `public`)
- **pg_net**: Installed in `extensions` for HTTP calls
- **Search Path**: `public, extensions` for all security definer functions

## Key Security Functions

### `has_admin(user_id)`
- Checks if user has admin role in `user_roles` table
- Used in RLS policies to grant admin privileges
- Security definer to avoid recursive RLS issues

### `allow_action(action, window_seconds, max_count)`  
- Rate limiting for sensitive operations
- Tracks actions in `request_throttle` table
- Returns boolean: allow/deny

## Frontend Security
- No secrets in client code
- Debug logging removed from production builds
- CSP header prevents XSS attacks
- Secure iframe breakout for OAuth flows

## Maintenance

### Regular Tasks
- Monitor `audit_log` table for suspicious activity
- Clean up old `request_throttle` records (automated via `cleanup_throttle_records()`)
- Review admin actions in audit logs

### Key Rotation
**If Supabase keys need rotation:**
1. Generate new keys in Supabase Dashboard → Settings → API
2. Update `.env` file (never commit keys)
3. Redeploy application
4. Test all functionality

### Security Monitoring
- Watch for failed authentication attempts
- Monitor rate limiting triggers
- Review audit logs for privilege escalation attempts
- Check for unauthorized storage access

## Emergency Procedures

### Suspected Breach
1. Immediately revoke Supabase API keys
2. Review audit logs for unauthorized changes
3. Check `request_throttle` for abuse patterns
4. Reset all user passwords if necessary
5. Review storage access logs

### Contact Information
- **Supabase Support**: https://supabase.com/support
- **Security Issues**: Report immediately via Supabase Dashboard

---
**Last Updated**: $(date)  
**Next Review**: $(date +30 days from now)