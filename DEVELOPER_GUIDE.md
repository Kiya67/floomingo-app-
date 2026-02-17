
# Developer Quick Reference - Block Feature Integration

## 🎯 What Was Done

The block/report feature has been fully integrated with the backend API. Here's what you need to know:

## 🔑 Key Changes

### 1. Authentication Setup ✅
- Better Auth configured with email/password + OAuth (Google, Apple)
- All API calls now use authenticated requests
- Session persistence across app reloads

### 2. Block API Integration ✅
- **Block User**: `POST /api/blocks` with `{ blocked_id }`
- **Unblock User**: `DELETE /api/blocks/:blocked_id`
- **Check Status**: `GET /api/blocks/check/:user_id`
- **List Blocked**: `GET /api/blocks`

### 3. UI Updates ✅
- Three-dot menu (⋯) on video full-screen view
- Three-dot menu (⋮) on user profile header
- Custom Modal component (web-compatible)
- Toast notifications for feedback

### 4. Feed Filtering ✅
- Home feed automatically excludes blocked users
- Video feed excludes blocked users from related videos

## 📂 New Files Created

```
components/ui/Modal.tsx       - Custom confirmation modal
components/ui/Toast.tsx       - Toast notification component
lib/auth.ts                   - Better Auth client
utils/api.ts                  - API wrapper with auth
contexts/AuthContext.tsx      - Auth provider & hooks
app/auth.tsx                  - Auth screen
app/auth-popup.tsx           - OAuth popup handler
app/auth-callback.tsx        - OAuth callback handler
```

## 🧪 How to Test

### 1. Start the App
```bash
npm run dev
```

### 2. Test Block Feature
1. Sign in with any account
2. Navigate to another user's profile or video
3. Tap the three-dot menu (⋯ or ⋮)
4. Select "Block User"
5. Verify:
   - Toast shows "User blocked"
   - User's content disappears from feed
   - You're automatically unfollowed

### 3. Test Unblock Feature
1. Go to a blocked user's profile
2. Tap three-dot menu
3. Select "Unblock User"
4. Verify:
   - Toast shows "User unblocked"
   - User's content reappears in feed

## 🐛 Troubleshooting

### Issue: "401 Unauthorized" errors
**Solution**: Make sure you're signed in. Check auth state:
```typescript
import { useAuth } from '@/contexts/AuthContext';
const { user, loading } = useAuth();
console.log('User:', user);
```

### Issue: Block doesn't work
**Solution**: Check console for `[API]` logs:
```
[API] Blocking user: abc123
[API] Block response: { success: true }
```

### Issue: Feed still shows blocked users
**Solution**: Pull to refresh the feed. The filter is applied on fetch.

## 🔧 Code Examples

### Using the API Wrapper
```typescript
import { authenticatedApiCall } from '@/utils/api';

// Block a user
const blockUser = async (userId: string) => {
  try {
    const response = await authenticatedApiCall('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked_id: userId }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Blocked:', data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### Using the Modal
```typescript
import { Modal } from '@/components/ui/Modal';

<Modal
  visible={showModal}
  onClose={() => setShowModal(false)}
  title="Delete Post?"
  message="This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  onConfirm={handleDelete}
  confirmColor="#FF3B30"
/>
```

### Using Toast
```typescript
import { Toast } from '@/components/ui/Toast';

const [toastVisible, setToastVisible] = useState(false);
const [toastMessage, setToastMessage] = useState('');
const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

const showToast = (message: string, type = 'info') => {
  setToastMessage(message);
  setToastType(type);
  setToastVisible(true);
};

// In render:
<Toast
  message={toastMessage}
  visible={toastVisible}
  onHide={() => setToastVisible(false)}
  type={toastType}
/>
```

## 📋 Architecture Rules Followed

✅ **NO RAW FETCH**: All API calls use `authenticatedApiCall` wrapper
✅ **NO ALERT()**: Custom Modal component for confirmations
✅ **AUTH BOOTSTRAP**: Session persistence with Better Auth
✅ **WEB COMPATIBLE**: All components work on web, iOS, and Android

## 🎨 UI/UX Patterns

### Block Flow
1. User taps three-dot menu
2. Modal shows "Block User" and "Report User" options
3. User taps "Block User"
4. Toast shows "User blocked" (success)
5. Content immediately hidden
6. User navigated back (if on blocked user's page)

### Unblock Flow
1. User taps three-dot menu on blocked user
2. Modal shows "Unblock User" (different color)
3. User taps "Unblock User"
4. Toast shows "User unblocked" (success)
5. Content becomes visible again

## 🚀 Performance Notes

- Block list fetched once per feed load
- Cached in memory during session
- Filtered on client-side for instant feedback
- Server-side filtering for data consistency

## 📝 TODO Items

- [ ] Implement Report User backend endpoint
- [ ] Add block list management screen
- [ ] Add "Blocked Users" section in settings
- [ ] Add analytics for block/unblock actions

## 🔐 Security Considerations

- All endpoints require authentication
- Users cannot block themselves (frontend + backend validation)
- Block relationships are bidirectional
- Blocked users cannot interact with blocker's content

## 📞 Need Help?

Check these files for reference implementations:
- `app/video/[id].tsx` - Full block/unblock implementation
- `app/user/[id].tsx` - Profile block/unblock
- `utils/api.ts` - API wrapper usage
- `components/ui/Modal.tsx` - Modal component
- `components/ui/Toast.tsx` - Toast component
