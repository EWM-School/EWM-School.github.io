package com.ewm.keeppracticing;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ensureDefaultFirebaseAppInitialized();
        super.onCreate(savedInstanceState);
    }

    /**
     * Initializes the default FirebaseApp from public client options when google-services.json
     * is not bundled, preventing FirebaseAuthenticationPlugin from throwing IllegalStateException
     * on cold startup.
     */
    private void ensureDefaultFirebaseAppInitialized() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setProjectId("gen-lang-client-0676218206")
                    .setApplicationId("1:1032022272683:web:d47e7566ba9e803d9765ee")
                    .setApiKey("AIzaSyCSobc1q5Y3ml1gukrM-cTD3BlbaiJ8tWY")
                    .setStorageBucket("gen-lang-client-0676218206.firebasestorage.app")
                    .setGcmSenderId("1032022272683")
                    .build();
                FirebaseApp.initializeApp(this, options);
            }
        } catch (Exception ignored) {
            // Safe fallback if already initialized concurrently
        }
    }
}
