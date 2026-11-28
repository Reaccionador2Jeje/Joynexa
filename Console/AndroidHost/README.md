# Joynexa Console — Android Host

Native Android launcher shell. The shared dashboard is placed in the app's assets folder and the Android bridge lets it list and launch apps installed on the device.

## Add the shared dashboard assets

Copy these three files from `Console/` into `Console/AndroidHost/app/src/main/assets/`:

- `index.html`
- `styles.css`
- `app.js`

Create the `assets` folder if it does not exist. Keep the three files together because the HTML references the CSS and JavaScript by relative path.

## Build

Open `Console/AndroidHost/` in Android Studio, install Android SDK 35 and JDK 17, then build the `app` module. A Gradle wrapper is not committed yet; Android Studio can generate one for the installed Gradle version.

## Android behavior

- Displays the same Joynexa dashboard.
- Lists launchable apps installed on the device through Android's launcher intent.
- Lets the user explicitly add an app to the Joynexa library.
- Starts only a package selected and saved in the library.
- Stores the app library in private SharedPreferences.
- USB/Bluetooth controllers are read through the shared Gamepad API when supported by the Android WebView/device.

This Android host is an initial implementation scaffold. It has not yet been built or tested on a physical Android device. Android's app picker is limited to apps exposed as launchable by the system; it does not enumerate arbitrary files or bypass Android permissions.
