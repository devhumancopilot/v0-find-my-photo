# Google Photos Picker API Setup Guide

This guide walks you through setting up Google Photos Picker API integration for the FindMyPhoto project.

## Prerequisites

- A Google Cloud Console account
- Admin access to your project

## Step 1: Create/Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Either select an existing project or click "New Project"
4. If creating new:
   - Enter project name (e.g., "FindMyPhoto")
   - Click "Create"

## Step 2: Enable Google Photos Picker API

1. In the Google Cloud Console, navigate to **APIs & Services > Library**
2. Search for "Google Photos Picker API" or "Photos Picker"
   - **IMPORTANT:** Do NOT confuse this with "Google Picker API" (deprecated)
3. Click on "**Google Photos Picker API**"
4. Click the "**Enable**" button
5. Wait for the API to be enabled (usually takes a few seconds)

## Step 3: Configure OAuth Consent Screen

Before creating credentials, you need to configure the OAuth consent screen:

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace organization)
3. Click "**Create**"
4. Fill in the required information:
   - **App name:** FindMyPhoto
   - **User support email:** Your email address
   - **Developer contact email:** Your email address
5. Click "**Save and Continue**"
6. On the "Scopes" page:
   - Click "**Add or Remove Scopes**"
   - Search for and select: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
   - This scope allows read-only access to photos selected by users via the Picker
7. Click "**Update**" and then "**Save and Continue**"
8. On "Test users" page (for development):
   - Click "**Add Users**"
   - Add email addresses that will test the integration
   - Click "**Save and Continue**"
9. Review and click "**Back to Dashboard**"

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click "**Create Credentials**" > "**OAuth client ID**"
3. If prompted to configure consent screen, complete Step 3 above first
4. Configure the OAuth client:
   - **Application type:** Web application
   - **Name:** FindMyPhoto Web Client

5. Configure **Authorized JavaScript origins:**
   - For development: `http://localhost:3000`
   - For production: `https://yourdomain.com` (replace with your actual domain)

6. Configure **Authorized redirect URIs:**
   - For development: `http://localhost:3000/api/auth/google/callback`
   - For production: `https://yourdomain.com/api/auth/google/callback`
   - You can add multiple URIs for different environments

7. Click "**Create**"
8. **IMPORTANT:** Copy and save:
   - **Client ID** (looks like: `123456789-abc123def456.apps.googleusercontent.com`)
   - **Client Secret** (keep this secure!)

## Step 5: Add Environment Variables

Add the following to your `.env.local` file:

\`\`\`env
# Google Photos Picker API Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
\`\`\`

**For production**, update to:
\`\`\`env
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
\`\`\`

## Step 6: Verify Setup

After implementing the code (following the main implementation), verify your setup:

1. Start your development server: `npm run dev`
2. Navigate to the upload page
3. Click "Connect Google Photos"
4. You should see the Google OAuth consent screen
5. Grant permissions
6. The Google Photos Picker should appear

## Important Notes

### OAuth Scope
The application uses the scope:
\`\`\`
https://www.googleapis.com/auth/photospicker.mediaitems.readonly
\`\`\`

This scope:
- ✅ Allows users to select photos via Google Photos Picker
- ✅ Provides read-only access to selected photos
- ✅ Complies with Google's updated policies (March 31, 2025)
- ❌ Does NOT allow browsing all photos without user selection
- ❌ Does NOT allow uploading or modifying photos

### Security Best Practices

1. **Never commit secrets:** Keep `.env.local` in `.gitignore`
2. **Use HTTPS in production:** Required by Google OAuth
3. **Rotate client secrets:** If compromised, regenerate immediately
4. **Limit redirect URIs:** Only add trusted domains
5. **Token expiry:** Access tokens expire after 1 hour; implement refresh logic
6. **Base URL expiry:** Photo URLs expire after 60 minutes

### Publishing Your App (Production)

During development, your app is in "Testing" mode with limited users. To publish:

1. Go to **OAuth consent screen**
2. Click "**Publish App**"
3. Google may review your app (can take days/weeks)
4. Once approved, any Google user can authenticate

For internal/small-scale use, "Testing" mode is sufficient (up to 100 test users).

### API Quotas

The Google Photos Picker API has usage quotas:
- Monitor usage in **APIs & Services > Dashboard**
- Default quotas are generous for most applications
- Contact Google if you need quota increases

## Troubleshooting

### "redirect_uri_mismatch" Error
- Ensure redirect URI in code exactly matches Google Cloud Console
- Check for trailing slashes (they matter!)
- Verify HTTP vs HTTPS

### "access_denied" Error
- User declined permissions
- Or, user email not added to test users list (in Testing mode)

### "invalid_client" Error
- Client ID or secret is incorrect
- Check environment variables are loaded properly

### Session Creation Fails
- Verify API is enabled in Google Cloud Console
- Check OAuth token is valid and not expired
- Ensure user has an active Google Photos account

### "RESOURCE_EXHAUSTED" Error
- Too many active sessions
- Implement proper session cleanup (delete after use)

## Next Steps

After completing setup:
1. Implement the backend API routes (see implementation files)
2. Add the frontend UI component
3. Test the complete flow
4. Deploy to production with updated redirect URIs

## Useful Resources

- [Google Photos Picker API Documentation](https://developers.google.com/photos/picker)
- [OAuth 2.0 Setup Guide](https://developers.google.com/photos/overview/configure-your-app)
- [Google Cloud Console](https://console.cloud.google.com/)
- [API Status & Updates](https://developers.google.com/photos/support/updates)

---

**Last Updated:** January 2025
**API Version:** v1
**Compliance:** March 31, 2025 policy updates
