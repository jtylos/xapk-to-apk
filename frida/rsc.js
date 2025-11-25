Java.perform(function () {
    console.log("[*] Starting resource fix script");

    var Resources = Java.use("android.content.res.Resources");
    var NotFoundException = Java.use("android.content.res.Resources$NotFoundException");

    // Hook Resources.getDrawable(int)
    Resources.getDrawable.overload("int").implementation = function (resId) {
        try {
            return this.getDrawable(resId);
        } catch (e) {
            if (e instanceof NotFoundException) {
                console.log("[*] Caught Resources$NotFoundException for ID: 0x" + resId.toString(16));
                if (resId === 0x7f080b07) { // maps_btn_myl resource ID from Logcat
                    console.log("[*] Returning fallback drawable for maps_btn_myl");
                    // Use a default Android drawable (ic_menu_mapmode)
                    return this.getDrawable(0x1080093); // android.R.drawable.ic_menu_mapmode
                }
            }
            throw e;
        }
    };

    // Hook Resources.getDrawable(int, Theme)
    Resources.getDrawable.overload("int", "android.content.res.Resources$Theme").implementation = function (resId, theme) {
        try {
            return this.getDrawable(resId, theme);
        } catch (e) {
            if (e instanceof NotFoundException) {
                console.log("[*] Caught Resources$NotFoundException for ID: 0x" + resId.toString(16));
                if (resId === 0x7f080b07) {
                    console.log("[*] Returning fallback drawable for maps_btn_myl");
                    return this.getDrawable(0x1080093, theme);
                }
            }
            throw e;
        }
    };

    console.log("[*] Resource fix hooks set up");
});