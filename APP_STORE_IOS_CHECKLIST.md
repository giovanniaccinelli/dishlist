# DishList iOS App Store Path

DishList is already set up as a Capacitor iOS app in `ios/App` and points to the production web app at `https://dishlist.vercel.app`.

## Current blocker

This Mac is on macOS 13.4. The App Store version of Xcode requires a newer macOS, so local Xcode install/build/upload is blocked on this machine unless macOS is updated.

If you do not want to update macOS, do not use the App Store Xcode route. Use a cloud Mac build service or another Mac.

## Recommended path without updating this Mac

Use one of these:

1. Xcode Cloud through App Store Connect.
2. Codemagic connected to the GitHub repo.
3. Borrow/use another Mac that can run the required current Xcode.

An old Xcode from Apple Developer Downloads may install on this Mac, but it is not a reliable App Store submission route because Apple requires recent SDK/Xcode versions for uploads.

## What is already done in the repo

- Capacitor packages are installed.
- iOS shell exists at `ios/App`.
- App id is `com.giovanniaccinelli.dishlist`.
- App name is `DishList`.
- The native app loads `https://dishlist.vercel.app`.
- iOS camera/photo permission strings are in `ios/App/App/Info.plist`.
- Capacitor privacy manifests are present through `@capacitor/ios`.

## Commands to run after web changes

```bash
cd /Users/giovanni/dishlists
npm run build
npm run cap:sync
git add -A
git commit -m "Update iOS app shell"
git push
```

## If you later install full Xcode locally

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
cd /Users/giovanni/dishlists
npm run cap:open:ios
```

Then in Xcode:

1. Select the `App` target.
2. Set Team to your Apple Developer account.
3. Confirm bundle id: `com.giovanniaccinelli.dishlist`.
4. Set version and build number.
5. Run on a real iPhone.
6. Archive.
7. Distribute to App Store Connect.

## App Store Connect checklist

Create a new app with:

- Name: `DishList`
- Bundle ID: `com.giovanniaccinelli.dishlist`
- SKU: `dishlist-ios-1`
- Platform: iOS

Prepare:

- App icon
- iPhone screenshots
- Description
- Subtitle
- Keywords
- Support URL
- Privacy Policy URL
- Privacy Nutrition Label
- Demo account for review if login is needed by reviewer

## Firebase / auth reminder

If Apple review uses the app through the Capacitor shell and login uses browser redirects, make sure any production domain used by the app is authorized in Firebase Authentication.
