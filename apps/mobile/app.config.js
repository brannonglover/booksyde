const packageJson = require("./package.json");

// The app version lives in package.json. Bump it with
// `npm version patch|minor|major --workspace=@booksyde/mobile`, which also
// runs scripts/sync-version.js to update the native projects.
const version = packageJson.version;

// iOS build number: a timestamp, so every build is higher than the last.
function getBuildNumber() {
  if (process.env.APP_BUILD_NUMBER) return process.env.APP_BUILD_NUMBER;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// Android versionCode must be a positive 32-bit integer.
// Minutes since 2024-01-01 gives ~4,000 years of headroom.
function getVersionCode() {
  if (process.env.APP_BUILD_NUMBER)
    return parseInt(process.env.APP_BUILD_NUMBER, 10);
  const epoch = new Date("2024-01-01T00:00:00Z").getTime();
  return Math.floor((Date.now() - epoch) / 60_000);
}

const buildNumber = getBuildNumber();
const versionCode = getVersionCode();

module.exports = {
  expo: {
    name: "Booksyde",
    slug: "booksyde",
    version,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "booksyde",
    userInterfaceStyle: "automatic",
    ios: {
      icon: "./assets/images/icon.png",
      bundleIdentifier: "com.booksyde.app",
      // Runs natively on iPad. iPhone stays portrait (`orientation` above); iPad
      // turns to any orientation and can share the screen in Split View, so every
      // screen has to lay out at any width.
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      buildNumber,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#2D4A3E",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.booksyde.app",
      versionCode,
    },
    web: {
      output: "server",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          // Booksyde green with the gold spectacles. SplashOverlay in
          // src/components/splash-overlay.tsx draws the same, so keep them in step.
          backgroundColor: "#2D4A3E",
          image: "./assets/images/splash-icon.png",
          imageWidth: 160,
        },
      ],
      "expo-font",
      "expo-web-browser",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Booksyde uses your photos so you can pick a picture for your bookplate.",
          cameraPermission:
            "Booksyde uses your camera so you can take a selfie for your bookplate.",
          microphonePermission: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "fdc05e05-3a05-4cda-81e1-e02b4cdaf7f4",
      },
    },
  },
};
