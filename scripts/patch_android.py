#!/usr/bin/env python3
"""Patch idempoten untuk proyek Android hasil `npx cap add android` (landscape, immersive, versi, signing)."""
from pathlib import Path
import re

A = Path(__file__).resolve().parent.parent / "android"
MAIN = A / "app/src/main"

man = MAIN / "AndroidManifest.xml"
s = man.read_text()
if "sensorLandscape" not in s:
    s = s.replace('android:launchMode="singleTask"', 'android:launchMode="singleTask"\n            android:screenOrientation="sensorLandscape"')
man.write_text(s)

act = MAIN / "java/id/archon/variables/MainActivity.java"
act.write_text('''package id.archon.variables;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/** Layar penuh immersive; layar tetap menyala selama bermain. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
''')

gr = A / "app/build.gradle"
s = gr.read_text()
if "keystore.properties" not in s:
    s = s.replace('versionCode 1\n        versionName "1.0"', 'versionCode appVersionCode\n        versionName appVersionName')
    s = s.replace("android {\n    namespace", '''def appVersionCode = Integer.parseInt((project.findProperty("versionCode") ?: System.getenv("VERSION_CODE") ?: "1").toString())
def appVersionName = (project.findProperty("versionName") ?: System.getenv("VERSION_NAME") ?: "1.0.0").toString()
def keystoreProps = new Properties()
def keystoreFile = rootProject.file("keystore.properties")
if (keystoreFile.exists()) keystoreFile.withInputStream { keystoreProps.load(it) }

android {
    namespace''', 1)
    s = s.replace("    buildTypes {\n        release {", '''    signingConfigs {
        release {
            if (keystoreProps["storeFile"]) {
                storeFile file(keystoreProps["storeFile"])
                storePassword keystoreProps["storePassword"]
                keyAlias keystoreProps["keyAlias"]
                keyPassword keystoreProps["keyPassword"]
            }
        }
    }
    buildTypes {
        release {
            if (keystoreProps["storeFile"]) signingConfig signingConfigs.release''')
gr.write_text(s)

colors = MAIN / "res/values/styles.xml"
t = colors.read_text()
t = t.replace('<item name="android:background">@null</item>', '<item name="android:background">@null</item>\n        <item name="android:windowBackground">@color/ic_launcher_background</item>') if "windowBackground" not in t else t
colors.write_text(t)
print("android dipatch")
