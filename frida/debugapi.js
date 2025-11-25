/*
 * Android Network Interceptor Script using Frida - V26-Debug (Definitive Method Discovery)
 *
 * This script uses Java's own reflection capabilities to definitively list all
 * methods of the relevant classes to find the real obfuscated names.
 *
 * It will find:
 * 1. The name of the `getBuffer()` method on the `okio.x` class.
 * 2. The name of the `clone()` method on the `okio.e` class.
 */

console.log("Frida Android Network Interceptor V26-Debug (Definitive Method Discovery) Loaded!");

Java.perform(function() {
    let discoveryDone = false;

    console.log("[*] Starting Interception...");

    try {
        const BridgeInterceptor = Java.use('okhttp3.internal.http.BridgeInterceptor');
        
        BridgeInterceptor.intercept.implementation = function(chain) {
            // We just need one successful response to trigger the discovery.
            const response = this.intercept(chain);

            if (discoveryDone) {
                return response;
            }

            const responseBody = response.body();
            if (responseBody) {
                try {
                    // --- STAGE 1: Find the "getter" method on the source (okio.x) ---
                    const source = responseBody.source();
                    const sourceClassName = source.$className;
                    console.log(`\n--- [DEBUG] STAGE 1: Finding getter method in class: ${sourceClassName} ---`);

                    const SourceClass = Java.use(sourceClassName).class;
                    const sourceMethods = SourceClass.getDeclaredMethods();
                    let getterMethodName = null;

                    console.log(`[DEBUG] Searching for a method in '${sourceClassName}' that takes NO arguments and returns 'okio.e'.`);
                    sourceMethods.forEach(function(method) {
                        const returnType = method.getReturnType().getName();
                        const params = method.getParameterTypes();
                        if (params.length === 0 && returnType === 'okio.e') {
                            getterMethodName = method.getName();
                            console.log(`  [+] Found candidate getter: ${getterMethodName}() | Returns: ${returnType}`);
                        }
                    });

                    if (!getterMethodName) {
                        console.error("[DEBUG] FAILED STAGE 1: Could not find the getter method. Aborting.");
                        discoveryDone = true;
                        return response;
                    }
                    console.log(`[DEBUG] SUCCESS STAGE 1: The getter method name is: >>> ${getterMethodName} <<<`);
                    
                    // --- STAGE 2: Find the "cloner" method on the buffer (okio.e) ---
                    const internalBuffer = source[getterMethodName](); // Call the method we just found
                    const bufferClassName = internalBuffer.$className; 
                    console.log(`\n--- [DEBUG] STAGE 2: Finding cloner method in class: ${bufferClassName} ---`);

                    const BufferClass = Java.use(bufferClassName).class;
                    const bufferMethods = BufferClass.getDeclaredMethods();
                    let clonerMethodName = null;
                    
                    console.log(`[DEBUG] Searching for a method in '${bufferClassName}' that takes NO arguments and returns an identical object.`);
                    bufferMethods.forEach(function(method) {
                        const methodName = method.getName();
                        const returnType = method.getReturnType().getName();
                        const params = method.getParameterTypes();
                        if (params.length === 0 && (returnType === bufferClassName || returnType === 'java.lang.Object')) {
                             console.log(`  [+] Found candidate cloner: ${methodName}() | Returns: ${returnType}`);
                             // We assume the real one isn't named 'toString' or something generic
                             if(methodName.length < 5) { // Good heuristic for obfuscated names
                                clonerMethodName = methodName;
                             }
                        }
                    });
                    
                    if (!clonerMethodName) {
                        console.error("[DEBUG] FAILED STAGE 2: Could not find the cloner method.");
                    } else {
                        console.log(`[DEBUG] SUCCESS STAGE 2: The cloner method name is most likely: >>> ${clonerMethodName} <<<`);
                    }

                    console.log("\n================ [DEBUG] FINAL RESULT ================ ");
                    console.log(`   Getter Method: ${getterMethodName}`);
                    console.log(`   Cloner Method: ${clonerMethodName}`);
                    console.log("========================================================\n");
                    console.log(">>> Use these two names in the V27 script. <<<");

                } catch(e) {
                    console.log(`[DEBUG] An error occurred during discovery: ${e.message}`);
                    console.log(e.stack);
                } finally {
                    discoveryDone = true; // Ensure we only run this once
                }
            }
            return response;
        };
        console.log("[*] Attached to okhttp3.internal.http.BridgeInterceptor");
    } catch (e) {
        console.error("[!] Failed to hook BridgeInterceptor: " + e.message);
    }
});