package dev.atdev.joynexa.console;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public final class MainActivity extends Activity {
    private static final String PREFS = "joynexa_console";
    private static final String LIBRARY = "android_games";
    private WebView webView;
    private final List<JSONObject> games = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        webView = new WebView(this);
        webView.setBackgroundColor(0xFF090D18);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new JoynexaBridge(), "joynexaAndroid");
        setContentView(webView);
        loadLibrary();
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void loadLibrary() {
        String raw = getSharedPreferences(PREFS, MODE_PRIVATE).getString(LIBRARY, "[]");
        try {
            JSONArray array = new JSONArray(raw);
            for (int i = 0; i < array.length(); i++) games.add(array.getJSONObject(i));
        } catch (JSONException ignored) {
            games.clear();
        }
    }

    private void saveLibrary() {
        JSONArray array = new JSONArray();
        for (JSONObject game : games) array.put(game);
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(LIBRARY, array.toString()).apply();
    }

    private JSONObject publicLibrary() throws JSONException {
        JSONArray array = new JSONArray();
        for (JSONObject game : games) {
            JSONObject item = new JSONObject();
            item.put("id", game.getString("id"));
            item.put("name", game.getString("name"));
            array.put(item);
        }
        JSONObject result = new JSONObject();
        result.put("type", "library");
        result.put("games", array);
        return result;
    }

    private void sendToPage(JSONObject value) {
        runOnUiThread(() -> webView.evaluateJavascript(
            "window.joynexaHostMessage(" + JSONObject.quote(value.toString()) + ");", null));
    }

    private void showAppPicker() {
        PackageManager pm = getPackageManager();
        Intent query = new Intent(Intent.ACTION_MAIN, null);
        query.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> apps = pm.queryIntentActivities(query, 0);
        Collections.sort(apps, Comparator.comparing(info -> info.loadLabel(pm).toString(), String.CASE_INSENSITIVE_ORDER));
        List<ResolveInfo> launchable = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        for (ResolveInfo info : apps) {
            String packageName = info.activityInfo.packageName;
            if (packageName.equals(getPackageName())) continue;
            launchable.add(info);
            labels.add(info.loadLabel(pm).toString());
        }
        if (launchable.isEmpty()) {
            sendError("No launchable apps were found on this device.");
            return;
        }
        runOnUiThread(() -> new AlertDialog.Builder(this)
            .setTitle("Add an Android app")
            .setItems(labels.toArray(new String[0]), (dialog, which) -> {
                ResolveInfo selected = launchable.get(which);
                String packageName = selected.activityInfo.packageName;
                try {
                    boolean exists = false;
                    for (JSONObject game : games) {
                        if (packageName.equals(game.optString("package"))) exists = true;
                    }
                    if (!exists) {
                        JSONObject entry = new JSONObject();
                        entry.put("id", UUID.randomUUID().toString());
                        entry.put("name", selected.loadLabel(pm).toString());
                        entry.put("package", packageName);
                        games.add(entry);
                        saveLibrary();
                    }
                    sendToPage(publicLibrary());
                } catch (JSONException error) {
                    sendError("Could not save that app.");
                }
            })
            .setNegativeButton("Cancel", (dialog, which) -> sendToPage(publicLibrary()))
            .show());
    }

    private void launchApp(String id) {
        for (JSONObject game : games) {
            if (!id.equals(game.optString("id"))) continue;
            String packageName = game.optString("package");
            Intent launch = getPackageManager().getLaunchIntentForPackage(packageName);
            if (launch == null) {
                sendError("That app is no longer available.");
                return;
            }
            runOnUiThread(() -> {
                try {
                    startActivity(launch);
                } catch (RuntimeException error) {
                    sendError("Android could not open that app.");
                }
            });
            return;
        }
        sendError("That app is not registered in the library.");
    }

    private void sendError(String message) {
        JSONObject result = new JSONObject();
        try {
            result.put("type", "host-error");
            result.put("message", message);
        } catch (JSONException ignored) { }
        sendToPage(result);
    }

    private final class JoynexaBridge {
        @JavascriptInterface
        public void postMessage(String raw) {
            try {
                JSONObject message = new JSONObject(raw);
                String type = message.optString("type");
                if ("get-library".equals(type)) {
                    sendToPage(publicLibrary());
                } else if ("pick-game".equals(type)) {
                    runOnUiThread(MainActivity.this::showAppPicker);
                } else if ("launch-game".equals(type)) {
                    launchApp(message.optString("id"));
                } else if ("exit-console".equals(type)) {
                    runOnUiThread(MainActivity.this::finish);
                }
            } catch (JSONException error) {
                sendError("Invalid request from the dashboard.");
            }
        }
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));", null);
    }
}
