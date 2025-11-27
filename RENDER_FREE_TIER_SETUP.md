# 🆓 Render Free Tier - Quick Setup Guide

Deploy Find My Photo to Render completely **FREE**!

## ⚡ Quick Start (5 Minutes)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "feat: deploy to Render"
git push origin main
```

### Step 2: Deploy on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select your repository
5. Render will auto-detect `render.yaml` ✅

### Step 3: Add Environment Variables

Click **"Advanced"** and add these (copy from your `.env` file):

**Required (App won't work without these):**
```bash
NEXT_PUBLIC_SUPABASE_URL=your-value-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-value-here
SUPABASE_SERVICE_ROLE_KEY=your-value-here
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-value-here
GOOGLE_CLIENT_SECRET=your-value-here
OPENAI_API_KEY=your-value-here
```

**Set redirect URL to Render:**
```bash
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://yourapp.onrender.com/dashboard
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://yourapp.onrender.com
```

### Step 4: Click "Create Web Service"

Wait 3-5 minutes for build to complete. ☕

### Step 5: Update OAuth Settings

**Google OAuth Console:**
1. Go to https://console.cloud.google.com
2. **APIs & Services** → **Credentials** → Your OAuth Client
3. Add to **Authorized redirect URIs:**
   ```
   https://your-app-name.onrender.com
   https://your-app-name.onrender.com/dashboard
   ```

**Supabase:**
1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs:**
   ```
   https://your-app-name.onrender.com/dashboard
   ```

---

## ⚠️ Free Tier Limitations & Workarounds

### 🥶 Cold Starts (15 minutes inactivity = sleep)

**The Issue:**
- After 15 min of no traffic, your app sleeps
- First visitor waits 30-60 seconds for app to wake up
- Subsequent requests are fast

**Workarounds:**

1. **Add Loading Page** (User sees progress instead of blank screen):
   - Create a custom loading.tsx in your app directory
   - Shows "Waking up the server..." message

2. **Keep-Alive Ping** (Prevent sleep with automated pings):
   - Use https://cron-job.org (free)
   - Ping your app every 14 minutes: `https://yourapp.onrender.com/`
   - Keeps app warm 24/7!

3. **User Expectation:**
   - Add a note: "First load may take a minute"
   - Most users understand free tier = some wait

---

## 🎯 Benefits vs Vercel Hobby (Why You Switched)

| Feature | Vercel Hobby | Render Free |
|---------|-------------|-------------|
| **Function Timeout** | ❌ 10 seconds | ✅ No limit |
| **Upload 500 photos** | ❌ Fails | ✅ Works |
| **Vision AI photos** | ⚠️ Max 20 | ✅ Can do 30-50+ |
| **Album creation** | ❌ Timeouts | ✅ Reliable |
| **Cold starts** | ✅ None | ⚠️ 30-60s |
| **Cost** | $0 | $0 |

**Bottom line:** Slower first load, but **everything actually works!** 🎉

---

## 🔧 Optional: Keep App Warm with Cron Job

### Free Cron Service Setup:

1. **Go to https://cron-job.org** (free, no credit card)
2. **Create account**
3. **Create new cron job:**
   - **Title:** Keep Render Warm
   - **URL:** `https://your-app-name.onrender.com/`
   - **Schedule:** Every 14 minutes
   - **Enabled:** Yes
4. **Save**

Now your app stays warm 24/7! 🔥

---

## 📊 What to Expect

### First Load (Cold Start):
- ⏱️ 30-60 seconds
- User sees browser loading
- Then app works normally

### Subsequent Loads (Warm):
- ⏱️ 200-500ms (normal speed)
- Fast and responsive

### If Active (Someone using it):
- Stays warm
- No delays

---

## 💡 Pro Tips

1. **Test During Off-Hours:**
   - Test when you know app is cold
   - Experience what users will see
   - Helps you understand UX

2. **Monitor Usage:**
   - Render Dashboard → **Metrics**
   - See when app is active
   - Identify peak times

3. **Gradual Vision Increase:**
   - Start with `VISION_MAX_PHOTOS=30`
   - Monitor processing time in logs
   - Increase to 50, 75, even 100 if fast enough!

4. **Share Your Link:**
   - More traffic = stays warm naturally
   - Active users = no cold starts

---

## ✅ Post-Deployment Checklist

After deployment completes:

- [ ] Visit your Render URL (wait for cold start if needed)
- [ ] Login with Google OAuth works
- [ ] Upload 10-20 photos
- [ ] **Congratulations modal appears** ✅
- [ ] **Countdown and redirect works** ✅
- [ ] Create album with "beach photos"
- [ ] **Step 2 loads with suggested photos** ✅
- [ ] Vision reasoning processes photos
- [ ] Can select and create album

**If ALL checks pass:** 🎉 You're successfully deployed!

---

## 🆙 Want to Upgrade Later?

If you want to remove cold starts:

1. Render Dashboard → Your Service → **Settings**
2. Change **Instance Type** from Free to **Starter ($7/month)**
3. No cold starts ever again!

---

## 📞 Quick Help

**Build fails?**
```bash
npm install -g pnpm && pnpm install && pnpm run build
```
Add this as build command if pnpm not found.

**Environment variables not loading?**
- Check spelling (case-sensitive!)
- No trailing spaces
- Restart service after adding

**Cold start too slow?**
- Normal for free tier
- Set up cron-job.org ping
- Or upgrade to Starter plan

---

**You're all set! Deploy and enjoy unlimited processing time! 🚀**
