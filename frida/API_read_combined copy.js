/*
 * Android Network Interceptor & Modifier Script - V39 (Complete)
 *
 * This version incorporates all previous fixes:
 * - Obfuscated class/method names (`okio.e`, `.y()`, `.G0()`, `.P0()`).
 * - Gzip-decompression for request bodies.
 * - Robust header logging for byte array values.
 * - Restores the full, original modification logic.
 */

console.log("Frida Network Modifier V39 (Complete) Loaded!");

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
            
            // --- Robust Request Header Logging ---
            const requestHeaders = request.headers();
            logBuffer.push('[REQUEST] Headers:');
            if (requestHeaders.size() > 0) {
                for (let i = 0; i < requestHeaders.size(); i++) {
                    const headerName = requestHeaders.name(i);
                    let headerValue = requestHeaders.value(i);
                    if (headerValue && headerValue.toString().startsWith('[B@')) {
                        headerValue = Java.use('java.lang.String').$new(headerValue);
                    }
                    logBuffer.push(`    ${headerName}: ${headerValue}`);
                }
            } else {
                logBuffer.push('    (No headers)');
            }

            // --- Gzip-Aware Request Body Logging ---
            const requestBody = request.body();
            if (requestBody) {
                try {
                    const OkioBuffer = Java.use("okio.e"); // Obfuscated 'okio.Buffer'
                    const buffer = OkioBuffer.$new();
                    requestBody.writeTo(buffer);

                    let bodyString = "";
                    const contentEncoding = requestHeaders.get('Content-Encoding');

                    if (contentEncoding && contentEncoding.toLowerCase() === 'gzip') {
                        logBuffer.push('[REQUEST] Body: (Gzipped, decompressing...)');
                        const GzipInputStream = Java.use('java.util.zip.GZIPInputStream');
                        const ByteArrayInputStream = Java.use('java.io.ByteArrayInputStream');
                        const ByteArrayOutputStream = Java.use('java.io.ByteArrayOutputStream');
                        const gzippedBytes = buffer.G0();
                        const bais = ByteArrayInputStream.$new(gzippedBytes);
                        const gzis = GzipInputStream.$new(bais);
                        const baos = ByteArrayOutputStream.$new();
                        const tempBuffer = Java.array('byte', new Array(1024).fill(0));
                        let bytesRead;
                        while ((bytesRead = gzis.read(tempBuffer, 0, tempBuffer.length)) !== -1) {
                            baos.write(tempBuffer, 0, bytesRead);
                        }
                        const decompressedBytes = baos.toByteArray();
                        bodyString = Java.use('java.lang.String').$new(decompressedBytes, "UTF-8");
                    } else {
                        bodyString = buffer.P0();
                    }
                    logBuffer.push(`[REQUEST] Body:\n${bodyString}`);
                } catch (e) {
                    logBuffer.push(`[REQUEST] Body: (Could not be read as text. Error: ${e.message})`);
                    logBuffer.push(e.stack);
                }
            } else {
                logBuffer.push('[REQUEST] Body: (none)');
            }
            
            const originalResponse = this.intercept(chain);
            const responseBody = originalResponse.body();
            logBuffer.push(`[RESPONSE] Code: ${originalResponse.code()}`);

            if (responseBody) {
                try {
                    const source = responseBody.source();
                    const Long = Java.use('java.lang.Long');
                    source.request(Long.MAX_VALUE.value);
                    const internalBuffer = source.getBuffer();
                    
                    const clonedBuffer = internalBuffer.y(); 
                    let responseBytes = clonedBuffer.G0();
                    const originalBodyString = Java.use('java.lang.String').$new(responseBytes, "UTF-8");
                    logBuffer.push(`[RESPONSE] Original Body:\n${originalBodyString}`);
                    
                    // ================================================================
                    // ==             FULL MODIFICATION LOGIC RESTORED               ==
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

                    // --- Example 3: Modify all open shifts to be "hot" shifts ---
                    if (url.includes("/api/openshift")) {
                        logBuffer.push("[MODIFIER] >>> Target 'openshift' FOUND. Setting all to hotShift=true...");
                        try {
                            let shiftsArray = JSON.parse(originalBodyString);
                            shiftsArray.forEach(function(shift) {
                                shift.hotShift = true;
                            });
                            let modifiedBodyString = JSON.stringify(shiftsArray);
                            responseBytes = Java.use('java.lang.String').$new(modifiedBodyString).getBytes();
                            wasModified = true;
                            logBuffer.push(`[MODIFIER] New Body Sent to App:\n${modifiedBodyString}`);
                        } catch (e) {
                            logBuffer.push(`[MODIFIER] FAILED: Could not modify JSON array. ${e.message}`);
                        }
                    }

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