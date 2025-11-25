/*
 * Frida Script: Heuristic-Based okio Class Finder
 *
 * This script attempts to dynamically identify obfuscated okio classes (like okio.Buffer)
 * by enumerating all loaded classes and checking for the presence of
 * characteristic methods commonly found in okio's core I/O classes.
 *
 * This is crucial when class names themselves are obfuscated (e.g., "okio.Buffer" -> "a.b.c").
 *
 * Usage:
 * 1. Save this code as `find_obfuscated_okio.js`.
 * 2. Ensure Frida server is running on your Android device.
 * 3. Run Frida from your host machine:
 * frida -U -f <package_name> -l find_obfuscated_okio.js --no-pause
 * (Replace <package_name> with the target app's package name, e.g., com.takeaway.driver)
 * OR, if the app is already running:
 * frida -U <process_name_or_pid> -l find_obfuscated_okio.js
 *
 * It's recommended to run this during app startup or when the relevant network
 * activity has just occurred, as the classes need to be loaded in memory.
 */

console.log("Frida Obfuscated okio Class Finder Script Loaded!");

Java.perform(function() {

    const classNames = Java.enumerateLoadedClassesSync();
    console.log(`[*] Total classes loaded: ${classNames.length}`);

    const okioCandidates = [];

    // Define characteristic method names for okio.Buffer/BufferedSource/BufferedSink.
    // These are the *original* method names. We hope they are not obfuscated,
    // or follow a pattern that allows us to recognize them.
    const characteristicOkioMethods = [
        "readUtf8", "writeUtf8", "size", "readByte", "writeByte",
        "read", "write", "emit", "flush", "buffer", "peek", "clear",
        "readDecimalLong", "writeDecimalLong", "readHexadecimalUnsignedLong", "writeHexadecimalUnsignedLong",
        "indexOf", "rangeEquals", "clone", "skip", "isOpen", "close", "timeout"
    ];

    console.log("[*] Searching for classes with okio-like characteristics...");

    classNames.forEach(function(className) {
        try {
            const clazz = Java.use(className);
            const methods = clazz.class.getDeclaredMethods(); // Get all declared methods
            let score = 0;
            const matchedMethodNames = new Set(); // To store the actual names of matched methods

            methods.forEach(function(method) {
                const methodName = method.getName();
                if (characteristicOkioMethods.includes(methodName)) {
                    score++;
                    matchedMethodNames.add(methodName);
                }
            });

            // A threshold for confidence that it's an okio.Buffer-like class.
            // okio.Buffer has many methods, so a higher score indicates higher confidence.
            // You might need to adjust this (e.g., 5-10 methods is a good start).
            if (score >= 5) {
                okioCandidates.push({
                    name: className,
                    score: score,
                    matchedMethods: Array.from(matchedMethodNames)
                });
            }

            // Also a quick check for direct 'okio' package prefix, though unlikely for your case
            if (className.startsWith("okio.")) {
                okioCandidates.push({
                    name: className,
                    score: "DIRECT_MATCH", // Indicate direct match for clarity
                    matchedMethods: Array.from(matchedMethodNames)
                });
            }

        } catch (e) {
            // Ignore errors for classes that can't be introspected (e.g., native classes, interfaces without implementation)
            // console.warn(`[!] Could not process class ${className}: ${e.message}`);
        }
    });

    if (okioCandidates.length > 0) {
        console.log("\n[+] Potential okio-like classes found (ranked by score):");
        // Sort candidates by score in descending order
        okioCandidates.sort((a, b) => {
            if (a.score === "DIRECT_MATCH") return -1; // Prioritize direct matches
            if (b.score === "DIRECT_MATCH") return 1;
            return b.score - a.score;
        });

        okioCandidates.forEach(candidate => {
            console.log(`--- Candidate: ${candidate.name} (Score: ${candidate.score}) ---`);
            console.log(`    Matched Methods: ${candidate.matchedMethods.join(', ')}`);
        });
        console.log("\n[!] The highest scoring candidates are likely the obfuscated okio classes.");
        console.log("    Look for the class with the highest score that contains many 'read'/'write' methods.");
        console.log("    This is likely your obfuscated okio.Buffer.");

    } else {
        console.log("[-] No potential okio-like classes found based on method heuristics.");
        console.log("    Consider adjusting the 'characteristicOkioMethods' list or the score threshold.");
        console.log("    Alternatively, use a decompiler like Jadx to confirm the obfuscated names.");
    }

    console.log("\n[*] okio class enumeration complete.");
});