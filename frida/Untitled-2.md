API_read_requests.js:
```
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
```

API_read_respons.js:
```
/*
 * Android Network Interceptor & Modifier Script - V34 (Final)
 *
 * This script provides a clean framework for modifying responses in-flight.
 * Add your own rules to the "MODIFICATION LOGIC" section.
 * It is built upon the stable V33 base.
 */

console.log("Frida Network Modifier V34 (Final) Loaded!");

Java.perform(function() {
    console.log("[*] Starting Interception...");

    try {
        const BridgeInterceptor = Java.use('okhttp3.internal.http.BridgeInterceptor');
        
        BridgeInterceptor.intercept.implementation = function(chain) {
            const logBuffer = [];
            const request = chain.request();
            const url = request.url().toString();
            
            logBuffer.push("\n================ [START] ================");
            logBuffer.push(`[REQUEST] URL: ${url}`);
            logBuffer.push(`[REQUEST] Method: ${request.method()}`);
            
            const originalResponse = this.intercept(chain);
            const responseBody = originalResponse.body();
            
            logBuffer.push(`[RESPONSE] Code: ${originalResponse.code()}`);

            if (responseBody) {
                try {
                    const source = responseBody.source();
                    const Long = Java.use('java.lang.Long');
                    source.request(Long.MAX_VALUE.value);

                    const internalBuffer = source.getBuffer();
                    const clonedBuffer = internalBuffer.y(); // y() is clone()
                    
                    // This is our master copy of the original data
                    let responseBytes = clonedBuffer.G0(); // G0() is readByteArray()

                    // Convert to string for logging and potential parsing
                    const originalBodyString = Java.use('java.lang.String').$new(responseBytes, "UTF-8");
                    logBuffer.push(`[RESPONSE] Original Body:\n${originalBodyString}`);
                    

                    // ================================================================
                    // ==                  MODIFICATION LOGIC START                  ==
                    // ================================================================

                    let wasModified = false;

                    // --- Example 1: Modify the city-rules endpoint ---
                    if (url.includes("/api/users/me/city-rules")) {
                        logBuffer.push("[MODIFIER] >>> Target 'city-rules' FOUND. Attempting to modify...");
                        try {
                            let jsonObject = JSON.parse(originalBodyString);
                            logBuffer.push(`[MODIFIER] Old minShiftDuration: ${jsonObject.minShiftDuration}`);
                            jsonObject.minShiftDuration = 1; // Set minimum shift duration to 1 minute
                            logBuffer.push(`[MODIFIER] New minShiftDuration: ${jsonObject.minShiftDuration}`);

                            let modifiedBodyString = JSON.stringify(jsonObject);
                            responseBytes = Java.use('java.lang.String').$new(modifiedBodyString).getBytes();
                            wasModified = true;
                            logBuffer.push(`[MODIFIER] New Body Sent to App:\n${modifiedBodyString}`);
                        } catch (e) {
                            logBuffer.push(`[MODIFIER] FAILED: Could not modify JSON. ${e.message}`);
                        }
                    }

                    // --- Example 2: Modify the courier status ---
                    if (url.includes("/shift-overview/courier/status")) {
                        logBuffer.push("[MODIFIER] >>> Target 'courier-status' FOUND. Attempting to modify...");
                        try {
                            let jsonObject = JSON.parse(originalBodyString);
                            logBuffer.push(`[MODIFIER] Old isWorking status: ${jsonObject.isWorking}`);
                            jsonObject.isWorking = false; // Always report that we are NOT working
                            logBuffer.push(`[MODIFIER] New isWorking status: ${jsonObject.isWorking}`);
                            
                            let modifiedBodyString = JSON.stringify(jsonObject);
                            responseBytes = Java.use('java.lang.String').$new(modifiedBodyString).getBytes();
                            wasModified = true;
                            logBuffer.push(`[MODIFIER] New Body Sent to App:\n${modifiedBodyString}`);
                        } catch(e) {
                             logBuffer.push(`[MODIFIER] FAILED: Could not modify JSON. ${e.message}`);
                        }
                    }

                    // --- Example 2: Modify some dates ---
                   // --- Rule: Modify all open shifts to be "hot" shifts ---
                    if (url.includes("/api/openshift")) {
                        logBuffer.push("[MODIFIER] >>> Target 'openshift' FOUND. Setting all to hotShift=true...");
                        try {
                            // The response is an array of shift objects
                            let shiftsArray = JSON.parse(originalBodyString);
                            
                            // Loop through each shift in the array
                            shiftsArray.forEach(function(shift) {
                                shift.hotShift = true;
                            });
                            
                            // Convert the modified array back to a JSON string
                            let modifiedBodyString = JSON.stringify(shiftsArray);
                            
                            // Update the bytes that will be sent to the app
                            responseBytes = Java.use('java.lang.String').$new(modifiedBodyString).getBytes();
                            wasModified = true;
                            logBuffer.push(`[MODIFIER] New Body Sent to App:\n${modifiedBodyString}`);
                        } catch (e) {
                            logBuffer.push(`[MODIFIER] FAILED: Could not modify JSON array. ${e.message}`);
                        }
                    }

                    // Add more 'if (url.includes(...))' blocks here for other endpoints

                    // ================================================================
                    // ==                   MODIFICATION LOGIC END                   ==
                    // ================================================================

                    if(wasModified) {
                        logBuffer.push("[MODIFIER] Response was MODIFIED.");
                    } else {
                        logBuffer.push("[MODIFIER] Response was NOT modified.");
                    }

                    const ResponseBody = Java.use('okhttp3.ResponseBody');
                    const newResponseBody = ResponseBody.create(responseBody.contentType(), responseBytes);
                    const newResponse = originalResponse.newBuilder().body(newResponseBody).build();
                    
                    logBuffer.push("================= [END] =================\n");
                    console.log(logBuffer.join('\n'));
                    return newResponse;

                } catch (e) {
                    logBuffer.push(`[RESPONSE] Error processing response body: ${e.message}`);
                    logBuffer.push(e.stack);
                }
            } else {
                logBuffer.push("[RESPONSE] Body is null.");
            }

            logBuffer.push("================= [END] =================\n");
            console.log(logBuffer.join('\n'));
            return originalResponse; 
        };
        console.log("[*] Attached to okhttp3.internal.http.BridgeInterceptor");
    } catch (e) {
        console.error("[!] Failed to hook BridgeInterceptor: " + e.message);
    }
});
```

