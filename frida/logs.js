Java.perform(function() {
    var Log = Java.use("android.util.Log");

    // Hooking Log.d (debug)
    Log.v.overload('java.lang.String', 'java.lang.String').implementation = function(tag, msg) {
        console.log("[V] " + tag + ": " + msg);
        return this.d(tag, msg); // Call original method
    };

        // Hooking Log.d (debug)
    Log.d.overload('java.lang.String', 'java.lang.String').implementation = function(tag, msg) {
        console.log("[D] " + tag + ": " + msg);
        return this.d(tag, msg); // Call original method
    };

            // Hooking Log.d (debug)
    Log.i.overload('java.lang.String', 'java.lang.String').implementation = function(tag, msg) {
        console.log("[I] " + tag + ": " + msg);
        return this.d(tag, msg); // Call original method
    };

    // You can add more overloads for other Log methods (i, w, e, v)
    // Log.i.overload('java.lang.String', 'java.lang.String').implementation = function(tag, msg) {
    //     console.log("[I] " + tag + ": " + msg);
    //     return this.i(tag, msg);
    // };
    // ... and so on for w, e, v
});