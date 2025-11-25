# Frida Setup and Usage Guide

## Prerequisites
- Rooted Android device
- ADB installed and working
- Frida tools installed on PC (`pip install frida-tools`)
- frida-server binary in `/data/local/tmp/` on the device

## Setup Steps

### 1. Set Permissions for frida-server
```powershell
adb shell "su -c chmod 755 /data/local/tmp/frida-server"
```

### 2. Start frida-server
```powershell
adb shell "su -c /data/local/tmp/frida-server &"
```

**Note:** You may see a SELinux warning like `Unable to load SELinux policy from the kernel: Failed to open file '/sys/fs/selinux/policy': Permission denied` - this is normal and can be ignored. The server will still work.

## Running Frida Scripts

### Option 1: Attach to Running App (Recommended)
1. Open the target app on your device manually
2. Run the Frida script:
```powershell
frida -U com.takeaway.driver -l frida\API_read_combined.js
```

### Option 2: Spawn App Fresh
```powershell
frida -U -f com.takeaway.driver -l frida\API_read_combined.js --no-pause
```

## Available Scripts

- **API_read_combined.js** - Main network interceptor and modifier script
  - Intercepts OkHttp requests/responses
  - Modifies API responses for testing
  - Filters by URL patterns (configurable at top of script)

## Troubleshooting

### "unable to find process with name 'system_server'" Error
This means frida-server isn't running. Solution:
1. Kill any existing frida-server: `adb shell "su -c 'pkill frida-server'"`
2. Start it again with the commands above

### App Not Found
Make sure the app package name is correct: `com.takeaway.driver`
List all running apps: `frida-ps -Uai`

### Permission Denied
Ensure your device is rooted and you're using `su -c` to run commands as root.

## Tips

- Keep frida-server running in the background - you don't need to restart it every time
- If you restart your device, you'll need to start frida-server again
- Use `frida-ps -U` to see all running processes
- Use `frida-ps -Uai` to see installed apps
