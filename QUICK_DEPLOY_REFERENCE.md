# 🚀 Quick Deploy Reference

## Your Render URLs
- **Frontend**: https://v0-find-my-photo.onrender.com
- **Backend**: https://v0-find-my-photo-backend.onrender.com

## Deploy Steps (Manual Web Services)

### 1️⃣ Deploy Backend First
1. Go to https://dashboard.render.com
2. New + → Web Service
3. Connect repo: `devhumancopilot/v0-find-my-photo`
4. **Name**: `v0-find-my-photo-backend`
5. **Root Directory**: `backend`
6. **Build**: `npm install -g pnpm && pnpm install && pnpm run build`
7. **Start**: `pnpm start`
8. Add environment variables (see below)

### 2️⃣ Deploy Frontend Second
1. New + → Web Service
2. Same repo: `devhumancopilot/v0-find-my-photo`
3. **Name**: `v0-find-my-photo`
4. **Root Directory**: (leave blank)
5. **Build**: `npm install -g pnpm && pnpm install && pnpm run build`
6. **Start**: `pnpm start`
7. Add environment variables (see below)

## Environment Variables

### Backend (`v0-find-my-photo-backend`)
```bash
NODE_ENV=production
FRONTEND_URL=https://v0-find-my-photo.onrender.com
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
OPENAI_API_KEY=your-openai-key
CLIP_SERVICE_URL=https://devjustin-fmp-clip.hf.space
CLIP_API_KEY=your-clip-api-key
EMBEDDING_PROVIDER=huggingface
ENABLE_VISION_RERANKING=true
VISION_MAX_PHOTOS=30
```

### Frontend (`v0-find-my-photo`)
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://v0-find-my-photo-backend.onrender.com
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://v0-find-my-photo.onrender.com
```

## Testing Checklist
- [ ] Backend shows status page
- [ ] Frontend loads UI
- [ ] Login works
- [ ] Upload shows congratulations modal
- [ ] Album creation Step 2 loads

## Troubleshooting
- **CORS errors**: Check FRONTEND_URL in backend
- **API fails**: Check NEXT_PUBLIC_API_URL in frontend
- **OAuth errors**: Update redirect URLs in Google Console & Supabase

## Full Guides
- **Manual Deploy**: `MANUAL_DEPLOY_GUIDE.md`
- **Architecture Details**: `SEPARATED_DEPLOYMENT_GUIDE.md`
