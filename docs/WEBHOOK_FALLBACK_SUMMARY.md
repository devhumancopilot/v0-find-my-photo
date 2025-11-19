# Webhook Fallback System - Quick Summary

## What Was Implemented

✅ **Automatic fallback system** - N8N primary, local Next.js handlers as backup
✅ **Service layer** - OpenAI, Storage, and Database services
✅ **Local webhook handlers** - 3 endpoints matching N8N workflows
✅ **Smart routing** - Automatic failover when N8N is down
✅ **Environment controls** - Easy toggle between modes

---

## Quick Start

### 1. Install OpenAI Package
```bash
npm install openai
```

### 2. Add Your OpenAI API Key
Edit `.env.local` and replace:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

With your actual key from: https://platform.openai.com/api-keys

### 3. Configuration (Already Set)
```bash
USE_LOCAL_WEBHOOKS=false           # Use N8N first
ENABLE_WEBHOOK_FALLBACK=true       # Fallback if N8N fails
STORE_BASE64_IN_DB=false           # Save DB space
```

### 4. Test It
Upload some photos and watch the logs:
- If N8N works: Uses N8N (you'll see `[v0] N8N webhook succeeded`)
- If N8N fails: Automatically uses fallback (you'll see `[Fallback] Processing...`)

---

## How It Works

```
User Upload → Next.js API → N8N (try first)
                              ↓ (if fails)
                            Local Handler (automatic)
                              ↓
                         OpenAI + Supabase
```

**Normal operation:** N8N handles everything
**When N8N fails:** Local handlers kick in automatically
**Zero impact:** Users never see the failure

---

## Files Created

### Services (lib/services/)
- `openai.ts` - Image captioning + embeddings
- `storage.ts` - Supabase Storage uploads
- `database.ts` - Database operations

### Webhook Handlers (app/api/dev-webhooks/)
- `photos-upload/route.ts` - Photo upload fallback
- `find-photos/route.ts` - Semantic search fallback
- `album-finalized/route.ts` - Album creation fallback

### Updated
- `lib/webhooks.ts` - Added fallback routing logic
- `.env.local` - Added configuration variables

### Documentation
- `docs/WEBHOOK_FALLBACK_IMPLEMENTATION.md` - Full implementation guide

---

## Configuration Modes

### Mode 1: Production (Recommended)
```bash
USE_LOCAL_WEBHOOKS=false
ENABLE_WEBHOOK_FALLBACK=true
```
**Result:** N8N primary, automatic fallback for reliability

### Mode 2: Local Development
```bash
USE_LOCAL_WEBHOOKS=true
```
**Result:** Skip N8N, use local handlers only (faster iteration)

### Mode 3: N8N Only
```bash
USE_LOCAL_WEBHOOKS=false
ENABLE_WEBHOOK_FALLBACK=false
```
**Result:** N8N only, no fallback (fails if N8N fails)

---

## What You Need To Do

1. ✅ Run: `npm install openai`
2. ✅ Add your OpenAI API key to `.env.local`
3. ✅ Test by uploading photos
4. ✅ Check logs to verify fallback works

That's it! The system is ready to go.

---

## Benefits

- **Reliability:** Never fails even if N8N is down
- **Performance:** Local handlers are slightly faster
- **Cost:** Reduce N8N dependency if needed
- **Testing:** Easy to test without N8N
- **Monitoring:** Full visibility into processing

---

## Need Help?

Check the full documentation:
- `docs/WEBHOOK_FALLBACK_IMPLEMENTATION.md` - Complete guide
- `docs/LOCAL_WEBHOOK_DEVELOPMENT_PLAN.md` - Original plan
- `docs/N8N_WEBHOOK_INTEGRATION.md` - N8N workflow details

Look for these log prefixes:
- `[v0]` - Webhook router logs
- `[Fallback]` - Local handler logs
