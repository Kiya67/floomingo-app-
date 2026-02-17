
# Testing Guide - Backend Integration

## 🎯 Overview

This guide will help you test the newly integrated backend features:
- SaveToTripsModal authentication fix
- Profile stats integration
- Block/Report feature

## ✅ Prerequisites

1. Backend API is running at: `https://jn958xzmbtrp3dkq4pzf9x4gqbxb8sh3.app.specular.dev`
2. Frontend app is running: `npm run dev`
3. You have at least 2 test accounts (to test blocking between users)

## 🧪 Test Scenarios

### 🎯 CRITICAL: SaveToTripsModal Authentication Fix

#### Scenario 1: Save Video to Trip (Authenticated)

**Steps:**
1. Sign in to the app
2. Navigate to Home feed
3. Tap on any video to open full-screen view
4. Tap the "Save" button (bookmark icon)
5. Wait for the modal to load
6. Select a trip from the list
7. Tap "Save"

**Expected Results:**
- ✅ Modal shows "Loading session..." briefly
- ✅ Session loads successfully
- ✅ Save button becomes enabled after session loads
- ✅ Video saves successfully
- ✅ Toast shows "Saved to [Trip Name]"
- ✅ No "Authentication token not found" error

**Console Logs to Check:**
```
Fetching user boards for save modal
Session loaded successfully for user: <user_id>
Boards fetched for modal: <count>
Saving post to board: <board_id>
[API] Saving video only to board: <board_id>
Video saved successfully
```

#### Scenario 2: Save Video with Location

**Steps:**
1. Sign in to the app
2. Navigate to a video that has a location
3. Tap the "Save" button
4. Select a trip
5. Ensure "Save video + location" is checked
6. Tap "Save"

**Expected Results:**
- ✅ Video and location both save to trip
- ✅ No authentication errors
- ✅ Success message appears

**Console Logs to Check:**
```
Saving video with location to board: <place_id>
[API] Saving video with location to board: <board_id>
Video saved successfully
```

#### Scenario 3: Session Refresh on Token Expiry

**Steps:**
1. Sign in to the app
2. Wait for session to expire (or manually clear token)
3. Try to save a video to a trip
4. Modal should attempt to refresh session

**Expected Results:**
- ✅ Modal detects missing token
- ✅ Attempts to refresh session automatically
- ✅ If refresh succeeds, save proceeds
- ✅ If refresh fails, shows "Please sign in again" error

**Console Logs to Check:**
```
No session token in handleSave
Attempting to refresh session...
Session refreshed successfully
```

---

### 🎯 Profile Stats Integration

#### Scenario 4: View Profile Stats

**Steps:**
1. Sign in to the app
2. Navigate to Profile tab
3. View your stats (Posts, Followers, Following)

**Expected Results:**
- ✅ Stats load from backend API
- ✅ Post count matches actual posts
- ✅ Follower/Following counts are accurate

**Console Logs to Check:**
```
Fetching profile stats from backend API
[API] Fetching profile stats for user: <user_id>
Profile stats fetched successfully from backend: { post_count: X, follower_count: Y, following_count: Z }
```

#### Scenario 5: Delete Post Updates Stats

**Steps:**
1. Sign in to the app
2. Navigate to Profile tab
3. Note your current post count
4. Long-press on one of your videos
5. Tap "Delete" in the confirmation modal
6. Wait for deletion to complete
7. Pull to refresh

**Expected Results:**
- ✅ Post is deleted
- ✅ Post count decrements by 1
- ✅ Stats refresh automatically
- ✅ Database triggers update profile_stats table

**Console Logs to Check:**
```
User confirmed delete for post: <post_id>
Post deleted successfully
Fetching profile stats from backend API
Profile stats fetched successfully from backend: { post_count: X-1, ... }
```

#### Scenario 6: View Other User's Stats

**Steps:**
1. Sign in to the app
2. Navigate to another user's profile
3. View their stats

**Expected Results:**
- ✅ Stats load from backend API
- ✅ Stats are accurate for that user

**Console Logs to Check:**
```
Fetching profile stats for user from backend API: <user_id>
[API] Fetching profile stats for user: <user_id>
Stats fetched successfully from backend: { post_count: X, ... }
```

---

### 🎯 Block/Report Feature

### Scenario 7: Block User from Video View

**Steps:**
1. Sign in to the app
2. Navigate to Home feed
3. Tap on any video to open full-screen view
4. Scroll to the horizontal action buttons at the bottom
5. Tap the three-dot menu (⋯) button (next to Share)
6. Tap "Block User"

**Expected Results:**
- ✅ Toast notification shows "User blocked"
- ✅ You're automatically unfollowed from that user
- ✅ App navigates back to previous screen
- ✅ Blocked user's posts no longer appear in Home feed

**Console Logs to Check:**
```
[API] Blocking user: <user_id>
[API] Block response: { success: true }
[API] User blocked successfully
```

---

### Scenario 8: Block User from Profile

**Steps:**
1. Sign in to the app
2. Navigate to another user's profile
3. Tap the three-dot menu (⋮) in the header (top-right)
4. Tap "Block User"

**Expected Results:**
- ✅ Toast notification shows "User blocked"
- ✅ You're automatically unfollowed from that user
- ✅ App navigates back to previous screen
- ✅ User's profile is no longer accessible

**Console Logs to Check:**
```
[API] Checking block status for user: <user_id>
[API] Block status: false
[API] Blocking user: <user_id>
[API] User blocked successfully
```

---

### Scenario 9: Unblock User

**Steps:**
1. Navigate to a blocked user's profile (if you can still access it)
2. Tap the three-dot menu (⋮)
3. Notice the button now says "Unblock User" (different color)
4. Tap "Unblock User"

**Expected Results:**
- ✅ Toast notification shows "User unblocked"
- ✅ User's posts reappear in Home feed (after refresh)
- ✅ You can now follow the user again

**Console Logs to Check:**
```
[API] Unblocking user: <user_id>
[API] Unblock response: { success: true }
[API] User unblocked successfully
```

---

### Scenario 10: Feed Filtering

**Steps:**
1. Block a user who has multiple posts
2. Navigate to Home feed
3. Pull to refresh

**Expected Results:**
- ✅ All posts from blocked user are hidden
- ✅ Feed only shows posts from non-blocked users
- ✅ No errors in console

**Console Logs to Check:**
```
[API] Blocked users fetched for feed filtering: <count>
Filtering out blocked users from feed: <count>
Posts fetched successfully: <count>
```

---

### Scenario 11: Video Feed Filtering

**Steps:**
1. Block a user
2. Open any video in full-screen view
3. Swipe up/down to see related videos

**Expected Results:**
- ✅ Blocked user's videos don't appear in the feed
- ✅ Only videos from non-blocked users are shown

**Console Logs to Check:**
```
[API] Blocked users fetched: <count>
Posts fetched successfully: <count>
```

---

### Scenario 12: Edge Cases

#### Test 12a: Cannot Block Yourself
**Steps:**
1. Navigate to your own profile
2. Notice there's no three-dot menu (⋮) in header

**Expected Results:**
- ✅ No block option available on your own profile
- ✅ No three-dot menu visible

#### Test 12b: Block Status Persistence
**Steps:**
1. Block a user
2. Close the app completely
3. Reopen the app
4. Navigate to the blocked user's profile

**Expected Results:**
- ✅ User is still blocked
- ✅ Three-dot menu shows "Unblock User"
- ✅ Block status persists across app reloads

---

### Scenario 13: Report User (Coming Soon)

**Steps:**
1. Navigate to any user's profile or video
2. Tap the three-dot menu
3. Tap "Report User"

**Expected Results:**
- ✅ Toast notification shows "Report functionality coming soon"
- ✅ No errors in console

---

## 🔍 Debugging Tips

### Check Authentication
```typescript
// In any component
import { useAuth } from '@/contexts/AuthContext';
const { user, loading } = useAuth();
console.log('Current user:', user);
```

### Check API Calls
Look for console logs prefixed with `[API]`:
```
[API] Requesting /api/blocks...
[API] Response: { success: true }
```

### Check Block Status
```typescript
// In video or profile screen
console.log('Is blocked:', isBlocked);
console.log('Block loading:', blockLoading);
```

### Check Feed Filtering
```
[API] Blocked users fetched: 2
Filtering out blocked users from feed: 2
Posts fetched successfully: 15
```

---

## 🐛 Common Issues & Solutions

### Issue: "401 Unauthorized" Error
**Cause**: Not authenticated or session expired
**Solution**: 
1. Sign out and sign back in
2. Check if `useAuth()` returns a valid user
3. Verify backend URL in `app.json`

### Issue: Block Doesn't Work
**Cause**: API call failed
**Solution**:
1. Check console for `[API]` error logs
2. Verify backend is running
3. Check network connectivity

### Issue: Feed Still Shows Blocked Users
**Cause**: Feed not refreshed
**Solution**:
1. Pull to refresh the feed
2. Close and reopen the app
3. Check if block API call succeeded

### Issue: Toast Not Showing
**Cause**: Toast component not rendered
**Solution**:
1. Check if `<Toast>` component is in the render tree
2. Verify `toastVisible` state is being set
3. Check console for errors

---

## 📊 Test Checklist

Use this checklist to ensure all features are working:

### SaveToTripsModal Authentication
- [ ] Save video to trip (authenticated)
- [ ] Save video with location
- [ ] Session loads before save button enabled
- [ ] Session refresh on token expiry
- [ ] No "Authentication token not found" errors
- [ ] Save button disabled until session ready

### Profile Stats Integration
- [ ] View own profile stats from backend API
- [ ] View other user's profile stats from backend API
- [ ] Delete post updates post count
- [ ] Stats refresh after post deletion
- [ ] Fallback to Supabase if backend fails

### Block/Report Feature
- [ ] Block user from video view
- [ ] Block user from profile view
- [ ] Unblock user from video view
- [ ] Unblock user from profile view
- [ ] Blocked user's posts hidden in Home feed
- [ ] Blocked user's videos hidden in video feed
- [ ] Automatic unfollow when blocking
- [ ] Toast notifications show correctly
- [ ] Cannot block yourself
- [ ] Block status persists across app reloads
- [ ] Report user shows "coming soon" message
- [ ] No console errors during block/unblock

### Cross-Platform
- [ ] Web version works correctly
- [ ] iOS version works correctly
- [ ] Android version works correctly

---

## 🎬 Demo Flow

**Quick Demo Script:**
1. Sign in with test account A
2. Navigate to test account B's profile
3. Tap three-dot menu → Block User
4. See toast "User blocked"
5. Navigate to Home feed
6. Pull to refresh
7. Verify account B's posts are gone
8. Navigate back to account B's profile
9. Tap three-dot menu → Unblock User
10. See toast "User unblocked"
11. Pull to refresh Home feed
12. Verify account B's posts are back

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________
Platform: [ ] Web [ ] iOS [ ] Android

SaveToTripsModal:
Scenario 1 - Save Video (Authenticated): [ ] Pass [ ] Fail
Scenario 2 - Save Video with Location: [ ] Pass [ ] Fail
Scenario 3 - Session Refresh: [ ] Pass [ ] Fail

Profile Stats:
Scenario 4 - View Profile Stats: [ ] Pass [ ] Fail
Scenario 5 - Delete Post Updates Stats: [ ] Pass [ ] Fail
Scenario 6 - View Other User's Stats: [ ] Pass [ ] Fail

Block/Report:
Scenario 7 - Block from Video: [ ] Pass [ ] Fail
Scenario 8 - Block from Profile: [ ] Pass [ ] Fail
Scenario 9 - Unblock User: [ ] Pass [ ] Fail
Scenario 10 - Feed Filtering: [ ] Pass [ ] Fail
Scenario 11 - Video Feed Filtering: [ ] Pass [ ] Fail
Scenario 12 - Edge Cases: [ ] Pass [ ] Fail
Scenario 13 - Report User: [ ] Pass [ ] Fail

Notes:
_________________________________
_________________________________
_________________________________
```

---

## 🚀 Next Steps After Testing

1. **If all tests pass**: Feature is ready for production
2. **If tests fail**: Check console logs and refer to "Common Issues" section
3. **Report bugs**: Include console logs and steps to reproduce
4. **Request features**: Document in GitHub issues

---

## 📞 Support

If you encounter issues:
1. Check console logs for `[API]` messages
2. Verify authentication is working
3. Ensure backend URL is correct
4. Review `DEVELOPER_GUIDE.md` for code examples
