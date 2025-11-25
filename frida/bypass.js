Java.perform(function () {
    console.log("[*] Starting combined bypass and logging script at " + new Date().toISOString());

    // --- Helper function for logging network calls (generic, without body content) ---
    function hookOkHttp() {
        try {
            var OkHttpClient = Java.use("okhttp3.OkHttpClient");
            var Request = Java.use("okhttp3.Request");
            var Response = Java.use("okhttp3.Response");
            // We remove references to RequestBody and Buffer here as they caused the error

            console.log("[*] Attempting to hook OkHttp for general network logging (URL, Method, Headers only).");

            // Hook newCall to log outgoing requests
            OkHttpClient.newCall.implementation = function (request) {
                console.log("\n[HTTP Request] URL: " + request.url());
                console.log("[HTTP Request] Method: " + request.method());
                
                var headers = request.headers();
                if (headers) {
                    console.log("[HTTP Request] Headers:");
                    for (var i = 0; i < headers.size(); i++) {
                        console.log("  " + headers.name(i) + ": " + headers.value(i));
                    }
                }
                // Removed request body logging due to okio.Buffer error

                var call = this.newCall(request);

                // Intercept the response asynchronously
                var originalEnqueue = call.enqueue.overload("okhttp3.Callback").implementation;
                call.enqueue.overload("okhttp3.Callback").implementation = function (callback) {
                    var newCallback = Java.registerClass({
                        name: 'okhttp3.LoggingCallback' + Math.random().toString(36).substring(2, 15), // Unique name
                        implements: [Java.use("okhttp3.Callback")],
                        methods: {
                            onResponse: function (call, response) {
                                console.log("\n[HTTP Response] URL: " + response.request().url());
                                console.log("[HTTP Response] Code: " + response.code());
                                console.log("[HTTP Response] Message: " + response.message());

                                var responseHeaders = response.headers();
                                if (responseHeaders) {
                                    console.log("[HTTP Response] Headers:");
                                    for (var i = 0; i < responseHeaders.size(); i++) {
                                        console.log("  " + responseHeaders.name(i) + ": " + responseHeaders.value(i));
                                    }
                                }
                                // Removed response body logging due to okio.Buffer error
                                
                                callback.onResponse(call, response); // Call original callback
                            },
                            onFailure: function (call, e) {
                                console.log("\n[HTTP Failure] URL: " + call.request().url());
                                console.log("[HTTP Failure] Error: " + e.getMessage());
                                callback.onFailure(call, e); // Call original callback
                            }
                        }
                    });
                    return originalEnqueue.call(this, newCallback.$new());
                };
                return call;
            };
        } catch (e) {
            console.log("[!] Error hooking OkHttp (likely due to class obfuscation/absence): " + e);
            console.log("[!] Skipping detailed OkHttp body logging.");
        }
    }

    hookOkHttp(); // Call the OkHttp hook at the start

    // --- Firebase Installations (obfuscated as com.google.firebase.installations.c) ---
    try {
        var FirebaseInstallations = Java.use("com.google.firebase.installations.c");
        var v7dClass = Java.use("v7.d"); // Assuming this class is correctly identified/exists

        // getId() hook - logging the original and modified ID
        FirebaseInstallations.B.overload("v7.d").implementation = function (arg) {
            console.log("[*] FirebaseInstallations.getId() called with arg: " + arg);
            var original = this.B(arg); 
            console.log("[*] Original Firebase Installation ID object: " + original);
            if (original) {
                try {
                    var originalId = original.getFirebaseInstallationId().get();
                    console.log("[*] Original Firebase Installation ID: " + originalId);
                    original.getFirebaseInstallationId().set("fake-installation-id-1234567890"); 
                    console.log("[*] Modified Firebase Installation ID to: fake-installation-id-1234567890");
                } catch (e) {
                    console.log("[!] Failed to get or modify FirebaseInstallationId: " + e);
                }
            }
            return original; 
        };

        // getToken() hook - logging the original call and returning fake token
        FirebaseInstallations.i.overload("boolean").implementation = function (arg) {
            console.log("[*] FirebaseInstallations.getToken() called with forceRefresh: " + arg);
            var CompletableFuture = Java.use("java.util.concurrent.CompletableFuture");
            var future = CompletableFuture.$new();
            var fakeToken = "fake-fcm-token-abcdef123456";
            future.complete(fakeToken);
            console.log("[*] Returning fake FCM token for FirebaseInstallations.getToken(): " + fakeToken);
            return future;
        };
    } catch (e) {
        console.log("[!] Error hooking FirebaseInstallations: " + e);
    }

    // --- Firebase Messaging (obfuscated as com.google.firebase.messaging.FirebaseMessaging) ---
    try {
        var FirebaseMessaging = Java.use("com.google.firebase.messaging.FirebaseMessaging");
        // getToken() hook - logging the original call and returning fake token
        FirebaseMessaging.k.overload().implementation = function () {
            console.log("[*] FirebaseMessaging.getToken() called.");
            var fakeToken = "fake-fcm-token-abcdef123456";
            console.log("[*] Returning fake FCM token for FirebaseMessaging.getToken(): " + fakeToken);
            return fakeToken; 
        };
    } catch (e) {
        console.log("[!] Error hooking FirebaseMessaging: " + e);
    }

    // --- Remote Config (obfuscated as com.google.firebase.remoteconfig.internal.m) ---
    try {
        var ConfigFetchHandler = Java.use("com.google.firebase.remoteconfig.internal.m");
        ConfigFetchHandler.w.overload("o5.l", "o5.l", "java.util.Date", "java.util.Map", "o5.l").implementation = function (arg1, arg2, arg3, arg4, arg5) {
            console.log("[*] RemoteConfig fetch called with args:");
            console.log("  arg1 (ConfigContainer?): " + arg1);
            console.log("  arg2 (ConfigContainer?): " + arg2);
            console.log("  arg3 (Date): " + arg3);
            console.log("  arg4 (Map<String, String>): " + arg4);
            console.log("  arg5 (ConfigContainer?): " + arg5);

            var CompletableFuture = Java.use("java.util.concurrent.CompletableFuture");
            var future = CompletableFuture.$new();
            future.complete(null); // Simulate successful fetch with null config
            console.log("[*] Bypassing RemoteConfig fetch: returning null config.");
            return future;
        };
    } catch (e) {
        console.log("[!] Error hooking RemoteConfig: " + e);
    }

    // --- Context permission check to bypass Google Play Services ---
    try {
        var Context = Java.use("android.content.Context");
        Context.checkCallingOrSelfPermission.implementation = function (permission) {
            console.log("[*] Intercepting permission check for: " + permission);
            if (permission.includes("com.google.android.gms")) {
                console.log("[*] Bypassing Google Play Services permission check for " + permission + ": returning GRANTED (0).");
                return 0; // PACKAGE_USAGE_STATS (granted)
            }
            var result = this.checkCallingOrSelfPermission(permission);
            console.log("[*] Original permission check result for " + permission + ": " + result);
            return result;
        };
    } catch (e) {
        console.log("[!] Error hooking Context permission check: " + e);
    }

    // --- Resource fix hooks (for maps_btn_myl.xml) ---
    try {
        var Resources = Java.use("android.content.res.Resources");
        var NotFoundException = Java.use("android.content.res.Resources$NotFoundException");

        Resources.getDrawable.overload("int").implementation = function (resId) {
            try {
                var drawable = this.getDrawable(resId);
                console.log("[*] getDrawable(int) called for ID: 0x" + resId.toString(16) + ", returning original drawable.");
                return drawable;
            } catch (e) {
                if (e instanceof NotFoundException) {
                    console.log("[*] Caught NotFoundException for ID: 0x" + resId.toString(16));
                    if (resId === 0x7f080b07) { // maps_btn_myl
                        console.log("[*] Returning fallback drawable (android.R.drawable.ic_menu_mapmode) for maps_btn_myl.");
                        return this.getDrawable(0x1080093); // android.R.drawable.ic_menu_mapmode
                    }
                }
                console.log("[!] Error in getDrawable(int) for ID: 0x" + resId.toString(16) + ": " + e);
                throw e;
            }
        };

        Resources.getDrawable.overload("int", "android.content.res.Resources$Theme").implementation = function (resId, theme) {
            try {
                var drawable = this.getDrawable(resId, theme);
                console.log("[*] getDrawable(int, Theme) called for ID: 0x" + resId.toString(16) + ", returning original drawable.");
                return drawable;
            } catch (e) {
                if (e instanceof NotFoundException) {
                    console.log("[*] Caught NotFoundException for ID: 0x" + resId.toString(16));
                    if (resId === 0x7f080b07) {
                        console.log("[*] Returning fallback drawable (android.R.drawable.ic_menu_mapmode) for maps_btn_myl.");
                        return this.getDrawable(0x1080093, theme);
                    }
                }
                console.log("[!] Error in getDrawable(int, Theme) for ID: 0x" + resId.toString(16) + ": " + e);
                throw e;
            }
        };
    } catch (e) {
        console.log("[!] Error hooking Resources: " + e);
    }

    console.log("[*] All hooks set up successfully");
});