Java.perform(function() {
    console.log("[*] Starting broad OkHttp API interception script...");

    try {
        const OkHttpClient = Java.use("okhttp3.OkHttpClient");
        const Interceptor = Java.use("okhttp3.Interceptor");
        const Request = Java.use("okhttp3.Request");
        const Response = Java.use("okhttp3.Response");
        const RequestBody = Java.use("okhttp3.RequestBody");
        const ResponseBody = Java.use("okhttp3.ResponseBody");
        const MediaType = Java.use("okhttp3.MediaType");

        // Use the Buffer class you found!
        const Buffer = Java.use("okio.h"); // Should be okio.Buffer
        // We also need the type of the sink expected by writeTo.
        const BufferedSink = Java.use("okio.buffer"); // Should be okio.BufferedSink

        console.log("[*] Successfully found OkHttp and Okio classes.");

        // Define our custom Interceptor class
        const MyInterceptor = Java.registerClass({
            name: "com.takeaway.driver.commons.api.MyInterceptor_" + Date.now(), // Make name unique
            implements: [Interceptor],
            methods: {
                intercept: function(chain) {
                    let request = chain.request();
                    let response = null; // Initialize response to null. This will hold the *original* response from chain.proceed.
                    let modifiedResponse = null; // This will hold our potentially rebuilt response.

                    try {
                        console.log("\n=======================================================");
                        console.log("[+] Intercepted OkHttp Request:");
                        console.log("    Method: " + request.method());
                        console.log("    URL: " + request.url());
                        console.log("    Headers:\n" + (request.headers() ? request.headers().toString().trim() : "No Headers"));

                        // Read Request Body (if present)
                        const requestBody = request.body();
                        if (requestBody) {
                            try {
                                const buffer = Buffer.$new(); // Create an instance of okio.Buffer (okio.x)
                                requestBody.writeTo(Java.cast(buffer, BufferedSink));
                                
                                const requestBodyString = buffer.O();
                                console.log("    Request Body: " + requestBodyString);

                            } catch (e) {
                                console.log("    Failed to read request body: " + e.message);
                                console.log("    Request Body (fallback toString): " + requestBody.toString());
                            }
                        } else {
                            console.log("    Request Body: (none)");
                        }

                        // Proceed with the original request to get the response
                        response = chain.proceed(request); // This is the original response.

                        console.log("\n[+] Intercepted OkHttp Response:");
                        console.log("    Status Code: " + response.code());
                        console.log("    Message: " + (response.message() ? response.message() : ""));
                        console.log("    Headers:\n" + (response.headers() ? response.headers().toString().trim() : "No Headers"));

                        // Handle Response Body
                        const responseBody = response.body();
                        if (responseBody) {
                            const originalContentType = responseBody.contentType(); // Define outside inner try/catch
                            const originalContentLength = responseBody.contentLength(); // Get original length
                            let responseBodyString = null; // Initialize as null

                            try {
                                if (originalContentType && originalContentType.type() === "text" && originalContentType.subtype() === "event-stream") {
                                    console.log("    Response Body: (Streaming - 'text/event-stream' type, skipping full body read to prevent issues)");
                                    modifiedResponse = response; // For streaming, pass original response directly
                                } else if (originalContentLength === 0) {
                                    console.log("    Response Body: (Empty, content-length is 0)");
                                    // For empty bodies, recreate without reading string() to avoid issues
                                    // Use originalContentType, or a default if null
                                    const emptyBodyMediaType = originalContentType || MediaType.parse("application/json"); // Fallback to a common type
                                    modifiedResponse = response.newBuilder()
                                        .body(ResponseBody.create.overload('okhttp3.MediaType', 'java.lang.String').call(emptyBodyMediaType, ""))
                                        .build();
                                    console.log("    [NOTE] Rebuilt empty Response Body to prevent app issues.");
                                } else {
                                    // For non-empty non-streaming bodies, read the string content
                                    responseBodyString = responseBody.string(); // This consumes the stream
                                    console.log("    Response Body (via string()): " + responseBodyString);

                                    // Rebuild Response Body to pass back to the app
                                    // Ensure originalContentType is not null and responseBodyString is not null before rebuilding
                                    if (originalContentType !== null && responseBodyString !== null) {
                                        const newResponseBody = ResponseBody.create.overload('okhttp3.MediaType', 'java.lang.String').call(originalContentType, responseBodyString);
                                        modifiedResponse = response.newBuilder().body(newResponseBody).build();
                                        console.log("    [NOTE] Rebuilt Response Body with string() content to prevent app issues.");
                                    } else {
                                        console.log("    [WARNING] Could not rebuild body: MediaType or string content was null/invalid after reading.");
                                        // Fallback for rebuilding failure: return original response (already consumed)
                                        modifiedResponse = response;
                                    }
                                }
                            } catch (e) {
                                console.log("    Failed to read or rebuild response body: " + e.message);
                                console.log("    Response Body (fallback toString): " + responseBody.toString());
                                // If any error occurs during reading/rebuilding, we must still return a response.
                                // The original `response` has already had its body consumed by `responseBody.string()`.
                                // We can either return the consumed original (which will crash later)
                                // or try to build an empty one or a minimal one.
                                // For now, let's return the original `response` to see if the crash still occurs.
                                modifiedResponse = response; // Return the (potentially consumed) original response
                            }
                        } else {
                            console.log("    Response Body: (none)");
                            modifiedResponse = response; // No body, no modification needed
                        }

                    } catch (e) {
                        console.error("[-] Error in OkHttp Interceptor: " + e.message);
                        // If any error occurs *before* chain.proceed(request)
                        // or if modifiedResponse isn't set for some reason,
                        // ensure we return a valid response from the chain.
                        // If response is null, it means chain.proceed failed or wasn't called.
                        if (response === null) {
                            response = chain.proceed(request); // This would re-try the network call
                        }
                        modifiedResponse = response; // In case of outer error, use original response as fallback
                    } finally {
                        console.log("=======================================================");
                    }

                    // Always return the modified or original response
                    return modifiedResponse !== null ? modifiedResponse : chain.proceed(request);
                }
            }
        });

        // Get an instance of our custom interceptor
        const myInterceptor = MyInterceptor.$new();

        // Inject this interceptor into ALL OkHttpClient.Builder instances
        const Builder = Java.use("okhttp3.OkHttpClient$Builder");

        Builder.$init.overload().implementation = function() {
            this.$init();
            this.addInterceptor(myInterceptor);
            console.log("[*] Injected MyInterceptor into new OkHttpClient.Builder instance (default constructor).");
        };

        Builder.$init.overload('okhttp3.OkHttpClient').implementation = function(okHttpClient) {
            this.$init(okHttpClient);
            this.addInterceptor(myInterceptor);
            console.log("[*] Injected MyInterceptor into new OkHttpClient.Builder instance (with client param).");
        };

    } catch (e) {
        console.error("[-] Failed to set up OkHttp Interception (initialization error): " + e.message);
        console.error("     Please check if 'okhttp3' and 'okio.x' classes are loaded and correctly named.");
    }

    console.log("[*] OkHttp interception script loaded. Waiting for network activity...");
});