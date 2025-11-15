# Security Fixes - Photo Search User Isolation

## Problem Identified

**Critical Security Issue**: The photo search functionality was returning photos belonging to other users instead of only the authenticated user's photos. This was a serious privacy and security vulnerability.

## Root Causes

### 1. Database Function Issue (CRITICAL)
**File**: `migrations/005_fix_match_photos_filter.sql`

The `match_photos` PostgreSQL function had a dangerous condition:

```sql
WHERE (filter_user_id IS NULL OR p.user_id = filter_user_id)
```

**Problem**: If `filter_user_id` was NULL, the function would return photos from ALL users, completely bypassing user isolation.

The function also used `SECURITY DEFINER` which bypasses Row Level Security (RLS) policies, meaning even though RLS was properly configured, this function could access all photos.

### 2. Missing API-Level Validation
**Files**:
- `app/api/webhooks/album-create-request/route.ts`
- `app/api/webhooks/album-finalized/route.ts`
- `app/api/dev-webhooks/album-finalized/route.ts`

The API endpoints were trusting:
1. The n8n webhook to return only the user's photos (defense-in-depth principle violated)
2. Client-supplied photo IDs without verification
3. No double-check that returned photos actually belong to the authenticated user

## Fixes Implemented

### Fix 1: Secure Database Function
**File**: `migrations/013_fix_match_photos_security.sql`

Created a new, secure version of `match_photos` that:

1. **Requires user_id**: Throws an error if `user_id` is not provided in the filter
2. **Always filters by user_id**: Removed the dangerous `OR NULL` condition
3. **Explicit security check**:
```sql
IF filter_user_id IS NULL THEN
  RAISE EXCEPTION 'user_id is required in filter parameter for security reasons';
END IF;
```

4. **Enforces user isolation**:
```sql
WHERE p.user_id = filter_user_id  -- ALWAYS filter, no exceptions
```

5. **Restricted permissions**:
```sql
GRANT EXECUTE ON FUNCTION match_photos TO authenticated;
REVOKE EXECUTE ON FUNCTION match_photos FROM anon;
```

### Fix 2: API-Level Photo Verification (Defense-in-Depth)
**File**: `app/api/webhooks/album-create-request/route.ts`

Added verification that all photos returned from the webhook actually belong to the authenticated user:

```typescript
// SECURITY CHECK: Verify all returned photos belong to the authenticated user
const photoIds = photos.map((p: any) => p.id).filter(Boolean)

if (photoIds.length > 0) {
  const { data: verifiedPhotos } = await supabase
    .from("photos")
    .select("id")
    .in("id", photoIds)
    .eq("user_id", user.id)  // ✓ Only user's photos

  const verifiedPhotoIds = new Set(verifiedPhotos?.map(p => p.id) || [])
  const filteredPhotos = photos.filter((p: any) => verifiedPhotoIds.has(p.id))

  const removedCount = photos.length - filteredPhotos.length
  if (removedCount > 0) {
    console.warn(`⚠️ SECURITY: Removed ${removedCount} photos that don't belong to user`)
  }
}
```

### Fix 3: Album Creation Photo ID Validation
**File**: `app/api/webhooks/album-finalized/route.ts`

Added validation to prevent users from adding other users' photos to their albums:

```typescript
// SECURITY CHECK: Verify all photo IDs belong to the authenticated user
const { data: verifiedPhotos } = await supabase
  .from("photos")
  .select("id")
  .in("id", photoIds)
  .eq("user_id", user.id)

const verifiedPhotoIds = verifiedPhotos?.map(p => p.id) || []
const unauthorizedPhotoIds = photoIds.filter(id => !verifiedPhotoIds.includes(id))

if (unauthorizedPhotoIds.length > 0) {
  console.warn(`⚠️ SECURITY: User attempted to add ${unauthorizedPhotoIds.length} unauthorized photos to album`)
  return NextResponse.json(
    { error: "Some photos do not belong to you or do not exist" },
    { status: 403 }  // Forbidden
  )
}
```

### Fix 4: Local Webhook Handler Validation
**File**: `app/api/dev-webhooks/album-finalized/route.ts`

Added the same verification to the local fallback handler for defense-in-depth:

```typescript
// SECURITY CHECK: Verify all photo IDs belong to the user
// Even though the calling endpoint should validate this, we double-check
const { data: verifiedPhotos } = await supabase
  .from("photos")
  .select("id")
  .in("id", photoIds)
  .eq("user_id", requestUser.id)

const unauthorizedPhotoIds = photoIds.filter(id => !verifiedPhotoIds.includes(id))

if (unauthorizedPhotoIds.length > 0) {
  console.error(`⚠️ SECURITY BREACH: Attempted to create album with ${unauthorizedPhotoIds.length} unauthorized photos!`)
  return NextResponse.json(
    { error: "Some photos do not belong to the user" },
    { status: 403 }
  )
}
```

## Security Principles Applied

### 1. **Defense in Depth**
Multiple layers of security:
- Database function enforces user isolation
- API endpoints verify photo ownership
- Local webhook handlers double-check
- Row Level Security (RLS) policies as additional layer

### 2. **Fail Secure**
If user_id is not provided, the system fails with an error rather than returning all data:
```sql
RAISE EXCEPTION 'user_id is required for security'
```

### 3. **Least Privilege**
Only authenticated users can execute the match_photos function:
```sql
GRANT EXECUTE ON FUNCTION match_photos TO authenticated;
REVOKE EXECUTE ON FUNCTION match_photos FROM anon;
```

### 4. **Input Validation**
All photo IDs from clients are verified before use:
- Search results verified to belong to user
- Album photo IDs verified to belong to user
- Cover photo ID verified to belong to user

### 5. **Audit Logging**
Security violations are logged:
```typescript
console.warn(`⚠️ SECURITY: Removed ${removedCount} photos that don't belong to user ${user.id}`)
```

## How to Deploy Fixes

### 1. Run Database Migration
```bash
# Apply the security fix migration
psql -U your_user -d your_database -f migrations/013_fix_match_photos_security.sql
```

Or via Supabase dashboard:
1. Go to SQL Editor
2. Paste contents of `migrations/013_fix_match_photos_security.sql`
3. Run the migration

### 2. Deploy API Changes
The API changes are in the codebase and will be deployed with your next deployment:
- `app/api/webhooks/album-create-request/route.ts`
- `app/api/webhooks/album-finalized/route.ts`
- `app/api/dev-webhooks/album-finalized/route.ts`

### 3. Verify Fixes
After deployment, verify:
1. Search only returns your own photos
2. Cannot add other users' photos to albums
3. Error messages appear in logs if security violations attempted

## Testing Verification

To verify the fixes work:

### Test 1: Photo Search Isolation
1. Create two test users (User A and User B)
2. Upload photos as User A
3. Upload different photos as User B
4. Search for photos as User A
5. **Expected**: Only User A's photos returned
6. Search for photos as User B
7. **Expected**: Only User B's photos returned

### Test 2: Album Creation Isolation
1. As User A, note a photo ID belonging to User B
2. Try to create an album as User A with User B's photo ID
3. **Expected**: 403 Forbidden error
4. Check logs for security warning

### Test 3: Database Function Security
```sql
-- Try to search without user_id (should fail)
SELECT * FROM match_photos(
  '[0.1, 0.2, ...]'::vector(1536),
  10,
  '{}'::jsonb  -- No user_id provided
);
-- Expected: Error "user_id is required in filter parameter for security reasons"
```

## Additional Recommendations

### 1. N8N Workflow Audit
If using n8n workflows, ensure they:
- Always pass user_id from the authenticated request
- Never accept user_id from client input
- Filter all database queries by user_id

### 2. Regular Security Audits
- Review all database functions with `SECURITY DEFINER`
- Audit all RLS policies
- Check for any queries missing user_id filters

### 3. Monitoring
Add monitoring for:
- Frequency of security warnings in logs
- Failed authorization attempts
- Unusual cross-user access patterns

## Files Changed

### New Files
- `migrations/013_fix_match_photos_security.sql` - Secure database function
- `SECURITY_FIXES.md` - This documentation

### Modified Files
- `app/api/webhooks/album-create-request/route.ts` - Added photo verification
- `app/api/webhooks/album-finalized/route.ts` - Added photo ID validation
- `app/api/dev-webhooks/album-finalized/route.ts` - Added local handler validation

### Unchanged (Already Secure)
- `app/api/photos/process-queue/route.ts` - Already filters by user_id
- `migrations/007_ensure_photos_rls_policies.sql` - RLS policies correct
- `lib/services/database.ts` - Already passes user_id to match_photos

## Summary

The security issue has been fixed at multiple levels:
1. ✅ Database function now **requires** and **enforces** user_id filtering
2. ✅ API endpoints verify all photos belong to authenticated user
3. ✅ Album creation validates all photo IDs
4. ✅ Security warnings logged for audit trail
5. ✅ Defense-in-depth approach ensures no single point of failure

**Impact**: Users can now only see and use their own photos. Cross-user data leakage is prevented at all layers.
