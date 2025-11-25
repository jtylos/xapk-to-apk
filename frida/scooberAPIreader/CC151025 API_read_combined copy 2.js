/*
 * Android Network Interceptor & Modifier Script - V40 (Complete)
 *
 * This version incorporates all previous fixes and ADDS REQUEST MODIFICATION LOGIC.
 */

console.log("Frida Network Modifier V40 (Complete) Loaded!");

// ================================================================
// ==                   LOGGING FILTER CONFIGURATION              ==
// ================================================================

// Set to true to enable filtering, false to log all requests
const ENABLE_FILTERING = false;

// HTTP methods to filter (empty array means log all methods)
// Examples: ["GET", "POST", "PUT", "DELETE"]
const FILTER_METHODS = ["POST"]; 

// URLs to include (empty array means include all URLs)
// Any URL containing these strings will be logged
const FILTER_URLS = ["scoober"]; 

// URLs to exclude (will override includes)
// Any URL containing these strings will NOT be logged
const EXCLUDE_URLS = ["datadog"];

// Function to determine if a request should be logged
function shouldLog(method, url) {
    if (!ENABLE_FILTERING) return true;
    
    // Check for URL exclusions first (highest priority)
    for (let i = 0; i < EXCLUDE_URLS.length; i++) {
        if (url.includes(EXCLUDE_URLS[i])) {
            return false;
        }
    }
    
    // Check method filter if specified
    let methodMatch = FILTER_METHODS.length === 0 || FILTER_METHODS.includes(method);
    
    // Check URL filter if specified
    let urlMatch = true;
    if (FILTER_URLS.length > 0) {
        urlMatch = false;
        for (let i = 0; i < FILTER_URLS.length; i++) {
            if (url.includes(FILTER_URLS[i])) {
                urlMatch = true;
                break;
            }
        }
    }
    
    // Both filters must match for logging to occur
    return methodMatch && urlMatch;
}

Java.perform(function() {
    console.log("[*] Starting Interception...");

    try {
        const BridgeInterceptor = Java.use('okhttp3.internal.http.BridgeInterceptor');
        
        BridgeInterceptor.intercept.implementation = function(chain) {
            const logBuffer = [];
            let request = chain.request(); // Use 'let' because we might modify and reassign it
            const url = request.url().toString();
            const method = request.method();
            const originalRequestBody = request.body(); // Keep a reference to the original body

            // Check if this request should be logged based on filters
            const shouldLogRequest = shouldLog(method, url);
            
            if (shouldLogRequest) {
                logBuffer.push("\n================ [START] ================");
                logBuffer.push(`[REQUEST] URL: ${url}`);
                logBuffer.push(`[REQUEST] Method: ${method}`);
                
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

                let requestBodyString = "";
                if (originalRequestBody) {
                    try {
                        const OkioBuffer = Java.use("okio.e"); // Obfuscated 'okio.Buffer'
                        const buffer = OkioBuffer.$new();
                        originalRequestBody.writeTo(buffer);

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
                            requestBodyString = Java.use('java.lang.String').$new(decompressedBytes, "UTF-8");
                        } else {
                            requestBodyString = buffer.J0(); // 'P0' for 'readUtf8' or similar on okio.Buffer actually readstring for 3.30 (C))
                        }
                        logBuffer.push(`[REQUEST] Original Body:\n${requestBodyString}`);
                    } catch (e) {
                        logBuffer.push(`[REQUEST] Body: (Could not be read as text. Error: ${e.message})`);
                        logBuffer.push(e.stack);
                    }
                } else {
                    logBuffer.push('[REQUEST] Body: (none)');
                }
            }
            
            // ================================================================
            // ==                   REQUEST MODIFICATION LOGIC               ==
            // ================================================================

            let requestWasModified = false;
            let newRequestBuilder = request.newBuilder(); // Start with a builder for potential changes

            // // --- Example 1: Modify a specific header for all requests ---
            // if (requestHeaders.get("User-Agent") && requestHeaders.get("User-Agent").includes("OkHttp")) {
            //     const oldAgent = requestHeaders.get("User-Agent");
            //     const newAgent = oldAgent.replace("OkHttp", "Frida-OkHttp");
            //     newRequestBuilder.removeHeader("User-Agent").addHeader("User-Agent", newAgent);
            //     logBuffer.push(`[REQ-MODIFIER] Changed User-Agent from '${oldAgent}' to '${newAgent}'`);
            //     requestWasModified = true;
            // }
            
            // --- Example 2: Modify a JSON request body for a specific endpoint ---
            // if (url.includes("/api/auth/login") && requestBodyString) {
            //     logBuffer.push("[REQ-MODIFIER] >>> Target 'auth/login' FOUND. Attempting to modify request body...");
            //     try {
            //         let jsonObject = JSON.parse(requestBodyString);
            //         if (jsonObject.password) {
            //             logBuffer.push(`[REQ-MODIFIER] Original password: ${jsonObject.password}`);
            //             jsonObject.password = "MyModifiedPassword123"; // Change the password
            //             logBuffer.push(`[REQ-MODIFIER] New password: ${jsonObject.password}`);
            //             requestBodyString = JSON.stringify(jsonObject);

            //             // Build a new request body with the modified string
            //             const MediaType = Java.use('okhttp3.MediaType');
            //             const RequestBody = Java.use('okhttp3.RequestBody');
                        
            //             // IMPORTANT: You need to know the Content-Type of the original request body.
            //             // Assuming it's application/json for login. Adjust if necessary.
            //             const mediaType = originalRequestBody.contentType(); // Get original content type
            //             const newRequestBody = RequestBody.create(mediaType, Java.use('java.lang.String').$new(requestBodyString).getBytes("UTF-8"));
                        
            //             newRequestBuilder.method(request.method(), newRequestBody); // Apply the new body
            //             requestWasModified = true;
            //             logBuffer.push(`[REQ-MODIFIER] New Request Body Sent to App:\n${requestBodyString}`);
            //         }
            //     } catch (e) {
            //         logBuffer.push(`[REQ-MODIFIER] FAILED: Could not modify request JSON. ${e.message}`);
            //     }
            // }
         // --- DELETE /api/shifts/{id} Modifier (SIMPLIFIED & LESS ERROR-PRONE) ---
 
            // Nullify datadog
            if (url.includes("datadog")){
                if (shouldLogRequest) {
                    logBuffer.push(`\n[REQ-MODIFIER] >>> Detected Datadog URL: ${url}. Nullifying request.`);
                }
                
                // Remove all headers (or selectively strip specific ones like "DD-API-KEY")
                newRequestBuilder.headers(Java.use("okhttp3.Headers$Builder").$new().build()); // Clears all existing headers

                // Nullify the request body
                const RequestBody = Java.use('okhttp3.RequestBody');
                newRequestBuilder.method(request.method(), RequestBody.create(null, Java.array('byte', []))); // Empty body

                requestWasModified = true;
            }

            if (shouldLogRequest && requestWasModified) {
                request = newRequestBuilder.build(); // Rebuild the request if anything was modified
                logBuffer.push(request);
                logBuffer.push("[REQ-MODIFIER] Request was MODIFIED.");
            } else if (shouldLogRequest) {
                logBuffer.push("[REQ-MODIFIER] Request was NOT modified.");
            }

            // ================================================================
            // ==                 END REQUEST MODIFICATION LOGIC             ==
            // ================================================================


            // Intercept with the (potentially modified) request
            const originalResponse = this.intercept(chain);
            const responseBody = originalResponse.body();
            
            if (shouldLogRequest) {
                logBuffer.push(`[RESPONSE] Code: ${originalResponse.code()}`);
            }

            if (responseBody) {
                try {
                    const source = responseBody.source();
                    const Long = Java.use('java.lang.Long');
                    source.request(Long.MAX_VALUE.value);
                    const internalBuffer = source.getBuffer();
                    
                    const clonedBuffer = internalBuffer.t(); // 'y()' for clone or similar
                    let responseBytes = clonedBuffer.z0(); // 'G0()' for toByteArray or similar
                    const originalBodyString = Java.use('java.lang.String').$new(responseBytes, "UTF-8");
                    
                    if (shouldLogRequest) {
                        logBuffer.push(`[RESPONSE] Original Body:\n${originalBodyString}`);
                    }
                    
                    // ================================================================
                    // ==             FULL MODIFICATION LOGIC RESTORED               ==
                    // ================================================================

                    let wasModified = false;

//                     [RESPONSE] Code: 200
// [RESPONSE] Original Body:
// {"endingTime":"22:30","maxShiftDuration":300,"minBreakDuration":0,"minShiftDuration":180,"openingHours":{"friday":{"end":"22:30","start":"11:00","isClosed":false},"monday":{"end":"22:30","start":"11:00","isClosed":false},"saturday":{"end":"22:30","start":"11:00","isClosed":false},"sunday":{"end":"22:30","start":"11:00","isClosed":false},"thursday":{"end":"22:30","start":"11:00","isClosed":false},"tuesday":{"end":"22:30","start":"11:00","isClosed":false},"wednesday":{"end":"22:30","start":"11:00","isClosed":false}},"startingTime":"11:00"}
// [RESP-MODIFIER] >>> Target 'city-rules' FOUND. Attempting to modify...
// [RESP-MODIFIER] Old minShiftDuration: 180
// [RESP-MODIFIER] New minShiftDuration: 1
// [RESP-MODIFIER] New Body Sent to App:
// {"endingTime":"22:30","maxShiftDuration":300,"minBreakDuration":0,"minShiftDuration":1,"openingHours":{"friday":{"end":"22:30","start":"11:00","isClosed":false},"monday":{"end":"22:30","start":"11:00","isClosed":false},"saturday":{"end":"22:30","start":"11:00","isClosed":false},"sunday":{"end":"22:30","start":"11:00","isClosed":false},"thursday":{"end":"22:30","start":"11:00","isClosed":false},"tuesday":{"end":"22:30","start":"11:00","isClosed":false},"wednesday":{"end":"22:30","start":"11:00","isClosed":false}},"startingTime":"11:00"}
// [RESP-MODIFIER] Response was MODIFIED.
// ================= [END] =================



                    // // --- Example 2: Modify the courier status ---
                    // if (url.includes("/shift-overview/courier/status")) {
                    //     logBuffer.push("[RESP-MODIFIER] >>> Target 'courier-status' FOUND. Attempting to modify...");
                    //     try {
                    //         let jsonObject = JSON.parse(originalBodyString);
                    //         logBuffer.push(`[RESP-MODIFIER] Old isWorking status: ${jsonObject.isWorking}`);
                    //         jsonObject.isWorking = false; // Always report that we are NOT working
                    //         logBuffer.push(`[RESP-MODIFIER] New isWorking status: ${jsonObject.isWorking}`);
                    //         let modifiedBodyString = JSON.stringify(jsonObject);
                    //         responseBytes = Java.use('java.lang.String').$new(modifiedBodyString).getBytes();
                    //         wasModified = true;
                    //         logBuffer.push(`[RESP-MODIFIER] New Body Sent to App:\n${modifiedBodyString}`);
                    //     } catch(e) {
                    //          logBuffer.push(`[RESP-MODIFIER] FAILED: Could not modify JSON. ${e.message}`);
                    //     }
                    // }

                    // --- Example 3: Modify all open shifts to be "hot" shifts ---
                    if (url.includes("/api/openshift")) {
                        if (shouldLogRequest) {
                            logBuffer.push("[RESP-MODIFIER] >>> Target 'openshift' FOUND. Setting all to hotShift=true...");
                        }
                        try {
                            let shiftsArray = JSON.parse(originalBodyString);
                            shiftsArray.forEach(function(shift) {
                                shift.hotShift = true;
                            });
                            let modifiedBodyString = JSON.stringify(shiftsArray);
                            responseBytes = Java.use('java.lang.String').$new(modifiedBodyString).getBytes();
                            wasModified = true;
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] New Body Sent to App:\n${modifiedBodyString}`);
                            }
                        } catch (e) {
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] FAILED: Could not modify JSON array. ${e.message}`);
                            }
                        }
                    }

                    // --- Modify opening hours for each day ---
                    if (url.includes("/api/users/me/city-rules")) {
                        if (shouldLogRequest) {
                            logBuffer.push("[RESP-MODIFIER] >>> Target 'city-rules' FOUND. Attempting to modify opening hours...");
                        }
                        try {
                            let jsonObject = JSON.parse(originalBodyString);
                            if (jsonObject.openingHours) {
                                for (const day in jsonObject.openingHours) {
                                    if (jsonObject.openingHours.hasOwnProperty(day)) {
                                        jsonObject.openingHours[day].start = "10:00";
                                        jsonObject.openingHours[day].end = "23:00";
                                    }
                                }
                                if (shouldLogRequest) {
                                    logBuffer.push("[RESP-MODIFIER] Updated opening hours for all days.");
                                }
                            }
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] Old minShiftDuration: ${jsonObject.minShiftDuration}`);
                            }
                            jsonObject.minShiftDuration = 1; // Set minimum shift duration to 1 minute
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] New minShiftDuration: ${jsonObject.minShiftDuration}`);
                                logBuffer.push(`[RESP-MODIFIER] Old maxShiftDuration: ${jsonObject.maxShiftDuration}`);
                            }
                            jsonObject.maxShiftDuration = 600; // Set minimum shift duration to 1 minute
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] New maxShiftDuration: ${jsonObject.maxShiftDuration}`);
                                logBuffer.push(`[RESP-MODIFIER] Old startingTime: ${jsonObject.startingTime}`);
                            }
                            jsonObject.startingTime = "10:00"; // Set minimum shift duration to 1 minute
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] New startingTime: ${jsonObject.startingTime}`);
                                logBuffer.push(`[RESP-MODIFIER] Old endingTime: ${jsonObject.endingTime}`);
                            }
                            jsonObject.endingTime = "23:00"; // Set minimum shift duration to 1 minute
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] New endingTime: ${jsonObject.endingTime}`);
                            }
                            let modifiedBodyString = JSON.stringify(jsonObject);
                            responseBytes = Java.use('java.lang.String').$new(modifiedBodyString).getBytes();
                            wasModified = true;
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] New Body Sent to App:\n${modifiedBodyString}`);
                            }
                        } catch (e) {
                            if (shouldLogRequest) {
                                logBuffer.push(`[RESP-MODIFIER] FAILED: Could not modify opening hours. ${e.message}`);
                            }
                        }
                    }

                    // ================================================================
                    // ==                   MODIFICATION LOGIC END                   ==
                    // ================================================================

                    if(shouldLogRequest) {
                        if(wasModified) {
                            logBuffer.push("[RESP-MODIFIER] Response was MODIFIED.");
                        } else {
                            logBuffer.push("[RESP-MODIFIER] Response was NOT modified.");
                        }
                    }

                    const ResponseBody = Java.use('okhttp3.ResponseBody');
                    const newResponseBody = ResponseBody.create(responseBody.contentType(), responseBytes);
                    const newResponse = originalResponse.newBuilder().body(newResponseBody).build();
                    
                    if (shouldLogRequest) {
                        logBuffer.push("================= [END] =================\n");
                        console.log(logBuffer.join('\n'));
                    }
                    return newResponse;

                } catch (e) {
                    if (shouldLogRequest) {
                        logBuffer.push(`[RESPONSE] Error processing response body: ${e.message}`);
                        logBuffer.push(e.stack);
                    }
                }
            } else if (shouldLogRequest) {
                logBuffer.push("[RESPONSE] Body is null.");
            }

            if (shouldLogRequest) {
                logBuffer.push("================= [END] =================\n");
                console.log(logBuffer.join('\n'));
            }
            return originalResponse; 
        };
        console.log("[*] Attached to okhttp3.internal.http.BridgeInterceptor");
    } catch (e) {
        console.error("[!] Failed to hook BridgeInterceptor: " + e.message);
    }
});