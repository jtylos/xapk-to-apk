Java.perform(function() {
    console.log("[*] Starting OkHttp3 Class Enumeration Script");

    var foundOkHttp = false;

    Java.enumerateLoadedClassesSync().forEach(function(className) {
        if (className.startsWith("okhttp3.") || className.includes("okhttp") || className.includes("retrofit")) {
            console.log("[*] Found potential network class: " + className);
            foundOkHttp = true;
        }
        // You might also look for other common network libraries
        if (className.includes("volley") || className.includes("apache.http") || className.includes("android.net.http")) {
             console.log("[*] Found potential network class (other): " + className);
             foundOkHttp = true;
        }
    });

    if (!foundOkHttp) {
        console.log("[-] No direct OkHttp or similar network classes found. Consider more advanced analysis (e.g., native hooks or traffic capture).");
    }

    console.log("[*] Class enumeration complete.");
});