
# Floomingo iOS TestFlight Release Guide

## ✅ Release Configuration Complete

Your app is now configured for TestFlight release with the following settings:

### 📱 App Configuration
- **App Name**: Floomingo
- **Display Name**: Floomingo
- **Bundle Identifier**: `com.houseofmakiya.floomingo`
- **Version**: 1.0.0
- **Build Number**: 1 (auto-increments with each build)

### 🔗 Deep Linking
- **Scheme**: `floomingo`
- **Deep Link Format**: `floomingo://**`

⚠️ **IMPORTANT**: Add `floomingo://**` to your Supabase Auth Redirect URLs:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add `floomingo://**` to the "Redirect URLs" list
3. Save changes

### 🌐 Production Environment Variables
Your production Supabase credentials are configured in `app.json`:
- **Supabase URL**: `https://ilobeaszwnfbwebemmji.supabase.co`
- **Supabase Anon Key**: Configured (production key)
- **Backend URL**: `https://jn958xzmbtrp3dkq4pzf9x4gqbxb8sh3.app.specular.dev`

✅ No localhost or dev endpoints remain - all production URLs are set.

### 🎨 App Assets
- **App Icon**: `./assets/images/IMG_1996.jpeg` (1024x1024 recommended)
- **Splash Screen**: `./assets/images/IMG_1996.jpeg`

⚠️ **RECOMMENDED**: Replace `IMG_1996.jpeg` with a proper 1024x1024 PNG app icon for best results.

## 🚀 Building for TestFlight

### Prerequisites
1. **Apple Developer Account** (paid membership required)
2. **EAS CLI** installed globally
3. **Xcode** installed (for iOS builds)
4. **App Store Connect** app created

### Build Commands

#### Option 1: EAS Build (Recommended - Cloud Build)
```bash
# Login to Expo account
eas login

# Configure the project (first time only)
eas build:configure

# Build for iOS production
eas build --platform ios --profile production

# After build completes, submit to TestFlight
eas submit --platform ios --profile production
```

#### Option 2: Local Build
```bash
# Generate native iOS project
npx expo prebuild --platform ios --clean

# Open in Xcode
open ios/floomingo.xcworkspace

# In Xcode:
# 1. Select "Any iOS Device" as target
# 2. Product → Archive
# 3. Distribute App → App Store Connect
# 4. Upload to TestFlight
```

### Build Profile Configuration
The `eas.json` file is configured with:
- **Development**: Internal distribution with simulator support
- **Preview**: Internal distribution for testing
- **Production**: App Store distribution (auto-increment build number)

### Incrementing Build Number
The build number auto-increments with each EAS build. If building manually:
1. Open `app.json`
2. Change `"buildNumber": "1"` to `"buildNumber": "2"` (and so on)
3. Rebuild

## 📋 Pre-Release Checklist

### ✅ Configuration
- [x] Bundle ID set to `com.houseofmakiya.floomingo`
- [x] Display name set to "Floomingo"
- [x] Version set to 1.0.0
- [x] Build number set to 1
- [x] Deep link scheme set to `floomingo`
- [x] Production Supabase URL configured
- [x] Production Supabase Anon Key configured
- [x] Production Backend URL configured
- [x] No localhost/dev endpoints remain

### ⚠️ Manual Steps Required
- [ ] Add `floomingo://**` to Supabase Auth Redirect URLs
- [ ] Replace app icon with 1024x1024 PNG (optional but recommended)
- [ ] Create app in App Store Connect
- [ ] Configure TestFlight beta testing settings
- [ ] Add beta testers in App Store Connect

### 🧪 Testing Before Release
- [ ] Test authentication flow (email + social login)
- [ ] Test deep linking (open `floomingo://` URLs)
- [ ] Test video upload and playback
- [ ] Test profile creation and editing
- [ ] Test follow/unfollow functionality
- [ ] Test boards and trips
- [ ] Test notifications
- [ ] Test on physical iOS device (not simulator)

## 🔐 Security Notes

### Environment Variables
All sensitive credentials are stored in `app.json` under `extra`:
- These are embedded in the app bundle at build time
- They are read via `Constants.expoConfig.extra` in the app
- No `.env` files are needed for Expo builds

### Authentication
- Deep link scheme `floomingo` is configured for OAuth callbacks
- Supabase will redirect to `floomingo://auth-callback` after social login
- Ensure this matches your Supabase Auth Redirect URLs

## 📱 TestFlight Distribution

### After Upload
1. **Processing**: Apple processes the build (10-30 minutes)
2. **Compliance**: Answer export compliance questions (ITSAppUsesNonExemptEncryption is set to false)
3. **Beta Testing**: Add internal/external testers
4. **Distribute**: Send TestFlight invites

### TestFlight Limits
- **Internal Testers**: Up to 100 (Apple Developer team members)
- **External Testers**: Up to 10,000 (requires App Review for first build)
- **Build Expiry**: 90 days

## 🐛 Troubleshooting

### Build Fails
- Check that all dependencies are installed
- Verify Apple Developer account is active
- Ensure bundle ID matches App Store Connect
- Check EAS build logs for specific errors

### Deep Linking Not Working
- Verify `floomingo://**` is in Supabase Redirect URLs
- Test with `xcrun simctl openurl booted floomingo://test`
- Check that `scheme` in app.json matches

### Authentication Issues
- Verify production Supabase credentials are correct
- Check that Supabase project is not paused
- Ensure backend URL is accessible
- Test API endpoints with production credentials

## 📞 Support

### Useful Links
- [Expo EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Supabase Dashboard](https://supabase.com/dashboard)

### Next Steps After TestFlight
1. Gather beta tester feedback
2. Fix any reported bugs
3. Increment build number and upload new builds
4. When ready, submit for App Store Review
5. Release to production! 🎉

---

**Your app is ready for TestFlight! 🚀**

Remember to:
1. Add `floomingo://**` to Supabase Auth Redirect URLs
2. Build with `eas build --platform ios --profile production`
3. Submit with `eas submit --platform ios --profile production`
