/*
 * Android Network Interceptor Script using Frida - Deeper Hook
 *
 * This script hooks into okhttp3.OkHttpClient.newCall (initial request)
 * and okhttp3.internal.http.RealInterceptorChain.proceed (after interceptors apply headers).
 * It also hooks into okhttp3.Callback for responses.
 *
 * Usage:
 * 1. Save this code as `android_network_interceptor_deep.js`.
 * 2. Ensure Frida server is running on your Android device.
 * 3. Run Frida from your host machine:
 * frida -U -f <package_name> -l android_network_interceptor_deep.js --no-pause
 * (Replace <package_name> with the target app's package name, e.g., com.example.app)
 *
 * Requirements:
 * - The target app uses okhttp3 for network communication.
 * - Basic understanding of Frida and Android app structure.
 */

console.log("Frida Android Network Interceptor Script Loaded! (Deeper Hook)");

Java.perform(function() {

    console.log("[*] Attaching to okhttp3.OkHttpClient.newCall (initial request)...");
    try {
        const OkHttpClient = Java.use('okhttp3.OkHttpClient');

        OkHttpClient.newCall.overload('okhttp3.Request').implementation = function(request) {
            console.log("\n[REQUEST - newCall] ========================================");
            console.log(`[REQUEST - newCall] URL: ${request.url().toString()}`);
            console.log(`[REQUEST - newCall] Method: ${request.method()}`);

            // Log Headers at newCall stage
            const headers = request.headers();
            console.log("[REQUEST - newCall] Headers:");
            if (headers.size() > 0) {
                for (let i = 0; i < headers.size(); i++) {
                    console.log(`[REQUEST - newCall]     ${headers.name(i)}: ${headers.value(i)}`);
                }
            } else {
                console.log("[REQUEST - newCall]     No headers found at newCall stage (size is 0).");
            }

            // Log Request Body (if available)
            const requestBody = request.body();
            if (requestBody) {
                const Buffer = Java.use("okio.e"); // okio.Buffer
                const buffer = Buffer.$new();
                requestBody.writeTo(buffer);
                try {
                    console.log(`[REQUEST - newCall] Body: ${buffer.P0()}`); // readUtf8() in newer Okio
                } catch (e) {
                    console.log(`[REQUEST - newCall] Body (Bytes): ${buffer.G0()}`); // readByteArray() in newer Okio
                }
            } else {
                console.log("[REQUEST - newCall] No request body.");
            }
            console.log("[REQUEST - newCall] ========================================\n");

            // Call the original method
            return this.newCall(request);
        };

        console.log("[*] Successfully hooked okhttp3.OkHttpClient.newCall.");

    } catch (e) {
        console.error("[!] Failed to hook okhttp3.OkHttpClient.newCall: " + e.message);
    }

    console.log("[*] Attaching to okhttp3.internal.http.RealInterceptorChain.proceed (post-interceptors)...");
    try {
        // This class is internal to OkHttp and is where the chain of interceptors
        // (including app-defined ones) processes the request before dispatching it.
        const RealInterceptorChain = Java.use('okhttp3.internal.http.RealInterceptorChain');

        RealInterceptorChain.proceed.overload('okhttp3.Request').implementation = function(request) {
            console.log("\n[REQUEST - INTERCEPTOR CHAIN] =============================");
            console.log(`[REQUEST - INTERCEPTOR CHAIN] URL: ${request.url().toString()}`);
            console.log(`[REQUEST - INTERCEPTOR CHAIN] Method: ${request.method()}`);

            // Log Headers after interceptors have run
            const headers = request.headers();
            console.log("[REQUEST - INTERCEPTOR CHAIN] Headers:");
            if (headers.size() > 0) {
                for (let i = 0; i < headers.size(); i++) {
                    console.log(`[REQUEST - INTERCEPTOR CHAIN]     ${headers.name(i)}: ${headers.value(i)}`);
                }
            } else {
                console.log("[REQUEST - INTERCEPTOR CHAIN]     No headers found at Interceptor Chain (size is 0). This is unexpected if auth headers should be present).");
            }

            // Log Request Body (if available)
            const requestBody = request.body();
            if (requestBody) {
                const Buffer = Java.use("okio.e"); // okio.Buffer
                const buffer = Buffer.$new();
                requestBody.writeTo(buffer);
                try {
                    console.log(`[REQUEST - INTERCEPTOR CHAIN] Body: ${buffer.P0()}`); // readUtf8() in newer Okio
                } catch (e) {
                    console.log(`[REQUEST - INTERCEPTOR CHAIN] Body (Bytes): ${buffer.G0()}`); // readByteArray() in newer Okio
                }
            } else {
                console.log("[REQUEST - INTERCEPTOR CHAIN] No request body.");
            }
            console.log("[REQUEST - INTERCEPTOR CHAIN] =============================\n");

            // Call the original method to continue the chain
            return this.proceed(request);
        };

        console.log("[*] Successfully hooked okhttp3.internal.http.RealInterceptorChain.proceed.");

    } catch (e) {
        console.error("[!] Failed to hook okhttp3.internal.http.RealInterceptorChain.proceed: " + e.message);
        console.error("[!] Note: The class 'okhttp3.internal.http.RealInterceptorChain' might have changed in newer OkHttp versions or be obfuscated. You might need to find the correct internal class for your app's OkHttp version.");
    }


    console.log("[*] Attaching to okhttp3.Callback.onResponse and onFailure...");
    try {
        const Callback = Java.use('okhttp3.Callback');

        Callback.onResponse.overload('okhttp3.Call', 'okhttp3.Response').implementation = function(call, response) {
            console.log("\n[RESPONSE] ========================================");
            console.log(`[RESPONSE] URL: ${response.request().url().toString()}`);
            console.log(`[RESPONSE] Code: ${response.code()}`);
            console.log(`[RESPONSE] Message: ${response.message()}`);

            // Log Headers
            const headers = response.headers();
            if (headers.size() > 0) {
                console.log("[RESPONSE] Headers:");
                for (let i = 0; i < headers.size(); i++) {
                    console.log(`[RESPONSE]     ${headers.name(i)}: ${headers.value(i)}`);
                }
            }

            // Log Response Body
            const responseBody = response.peekBody(2048); // Peek up to 2KB to avoid consuming the stream
            if (responseBody) {
                try {
                    // Try to read as UTF-8. If it fails, log as bytes.
                    console.log(`[RESPONSE] Body: ${responseBody.string()}`);
                } catch (e) {
                    console.log(`[RESPONSE] Body (Bytes): ${responseBody.bytes()}`);
                }
            } else {
                console.log("[RESPONSE] No response body or body already consumed.");
            }
            console.log("[RESPONSE] ========================================\n");

            // Call the original method
            this.onResponse(call, response);
        };

        Callback.onFailure.overload('okhttp3.Call', 'java.io.IOException').implementation = function(call, e) {
            console.error("\n[FAILURE] ========================================");
            console.error(`[FAILURE] Request URL: ${call.request().url().toString()}`);
            console.error(`[FAILURE] Exception: ${e.getMessage()}`);
            console.error("[FAILURE] ========================================\n");

            // Call the original method
            this.onFailure(call, e);
        };

        console.log("[*] Successfully hooked okhttp3.Callback.onResponse and onFailure.");

    } catch (e) {
        console.error("[!] Failed to hook okhttp3.Callback: " + e.message);
    }

    console.log("[*] API Interception setup complete. Waiting for network activity...");
});