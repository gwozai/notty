# Notty Mobile (iOS + Android)

The mobile apps are the **same React app** shipped through **Tauri v2 mobile** —
no Expo, no React Native, no second codebase. The TipTap/Yjs editor, contexts,
and passkey auth are reused as-is. Only three things differ from desktop:

1. **`MobileAdapter`** (`src/lib/mobile-adapter.ts`) — a cloud adapter that talks
   to `https://notty.page` and carries the session as an `X-Session-Token`
   header (the mobile webview runs on `tauri://localhost`, so cookies can't be
   same-origin). It extends `WebAdapter` through the new `request()`/`authHeaders()`
   seam, so all REST endpoints are reused verbatim.
2. **Passkey auth via deep link** — identical to the desktop flow: the system
   browser runs the WebAuthn ceremony on `notty.page`, then `notty://auth?token=…`
   returns and is exchanged for a session token stored in the Tauri store.
3. **A native mobile UI** (`src/client/pages/mobile/*`, `src/components/mobile/*`)
   — bottom tab bar, FAB, full-screen editor, safe-area insets. Selected at
   runtime via `isTauriMobile` in `src/client/main.tsx`.

Desktop-only Rust (global shortcuts, the floating quick-note window) is gated
behind `#[cfg(desktop)]`, so the crate compiles for iOS/Android.

---

## Prerequisites (one-time)

```sh
# Rust mobile targets
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios          # iOS
rustup target add aarch64-linux-android armv7-linux-androideabi \
                  i686-linux-android x86_64-linux-android                            # Android

# iOS: full Xcode (NOT just Command Line Tools) + CocoaPods
#   Install Xcode from the App Store, then:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -runFirstLaunch
brew install cocoapods

# Android: Android Studio, then install SDK + NDK and export:
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk | tail -1)"
```

The Tauri CLI is already a dev dependency — invoke it with `bunx tauri …`.

---

## Initialize the native projects (one-time)

```sh
bunx tauri ios init       # generates src-tauri/gen/apple
bunx tauri android init   # generates src-tauri/gen/android
```

### Register the `notty://` auth deep link

`tauri ios/android init` create the platform projects; the custom URL scheme
must be added once so the passkey redirect can return to the app.

**iOS** — `src-tauri/gen/apple/notty_iOS/Info.plist`, inside the top `<dict>`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>dev.notty.app</string>
    <key>CFBundleURLSchemes</key>
    <array><string>notty</string></array>
  </dict>
</array>
```

**Android** — `src-tauri/gen/android/app/src/main/AndroidManifest.xml`, inside the
main `<activity>`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="notty" android:host="auth" />
</intent-filter>
```

---

## Run

```sh
# Simulator / emulator (localhost dev server works)
bunx tauri ios dev
bunx tauri android dev

# Physical device — the dev server must be reachable over LAN. Either run on a
# device with `--host`, or just build a release and install it:
bunx tauri ios dev --host
```

> For physical-device dev, change `beforeDevCommand` to `bunx vite --host` (binds
> Vite to 0.0.0.0) or pass `--host` so the phone can reach the dev server.

## Build release binaries

```sh
bunx tauri ios build       # .ipa (needs an Apple Developer signing team in Xcode)
bunx tauri android build   # .apk / .aab
```

---

## How auth works on device

1. Sign-in screen → **Sign in with Passkey** → `MobileAdapter.startPasskeySignIn()`
   opens the system browser at `notty.page/auth/passkey?redirect=notty://auth`.
2. WebAuthn runs in the real browser (where passkeys are fully supported).
3. `notty.page` mints a one-time token and redirects to `notty://auth?token=…`.
4. The OS hands the deep link to the app → `lib.rs` re-emits it as `auth-deep-link`
   → `useDeepLinkAuth` → `handleDeepLinkToken` exchanges it for a session token,
   stores it in the Tauri store, and reloads.
5. On reload `MobileAdapter` reads the token and every request is authenticated.

Sign-out clears the stored token; passkey-locked notes are read-only on mobile
(unlock them on web/desktop) since that ceremony needs an in-page origin.

## What can't be verified in CI here

This environment has no full Xcode / Android SDK / iOS-Android Rust targets, so
the on-device build wasn't run here. What *was* verified: `cargo check` (desktop
compiles after the `lib.rs` + `#[cfg(desktop)]` refactor) and `bunx vite build`
(the whole frontend incl. the mobile screens + `MobileAdapter` bundles clean).
Run the `tauri ios/android` commands above on a machine with the toolchains.
