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