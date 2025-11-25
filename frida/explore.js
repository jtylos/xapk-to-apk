Java.perform(function () {
    console.log("[*] Enumerating loaded classes at " + new Date().toISOString());
    Java.enumerateLoadedClasses({
        onMatch: function(className) {
            if (className.includes("firebase") || className.includes("Resources")) {
                console.log("[*] Found class: " + className);
            }
        },
        onComplete: function() {
            console.log("[*] Enumeration complete");
        }
    });
});