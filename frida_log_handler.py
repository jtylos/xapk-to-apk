#!/usr/bin/env python3
# Frida Log Handler for API_read_combined.js

import frida
import sys
import os
import time
from datetime import datetime

# Configuration
PACKAGE_NAME = "com.takeaway.driver"  # Replace with your app package name
SCRIPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                          "frida", "API_read_combined.js")
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")

# Ensure log directory exists
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# Create a timestamped log file
log_filename = os.path.join(LOG_DIR, f"frida_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")

def on_message(message, data):
    """Handle messages from the Frida script"""
    if message['type'] == 'send':
        payload = message['payload']
        if isinstance(payload, dict) and payload.get('type') == 'log_data':
            # Write log message to file
            with open(log_filename, 'a', encoding='utf-8') as log_file:
                if 'timestamp' in payload:
                    log_file.write(f"[{payload['timestamp']}] ")
                log_file.write(f"{payload['message']}\n")
                # Also print to console if you want to see logs in real-time
                print(f"Log saved: {payload['message'][:50]}..." if len(payload['message']) > 50 else payload['message'])
    elif message['type'] == 'error':
        print(f"Error: {message['stack']}")
        with open(log_filename, 'a', encoding='utf-8') as log_file:
            log_file.write(f"ERROR: {message['stack']}\n")

def main():
    print(f"Frida Log Handler - Logs will be saved to: {log_filename}")
    
    try:
        # Try to attach to USB device first
        device = frida.get_usb_device(timeout=5)
        print(f"Connected to USB device: {device.name}")
    except frida.TimedOutError:
        # Fall back to local device if no USB device found
        try:
            device = frida.get_local_device()
            print(f"Using local device: {device.name}")
        except Exception as e:
            print(f"Failed to connect to any device: {str(e)}")
            return

    try:
        # Try to spawn the app if it's not running
        try:
            pid = device.spawn([PACKAGE_NAME])
            device.resume(pid)
            print(f"Spawned {PACKAGE_NAME} with PID {pid}")
            time.sleep(1)  # Give it a moment to start
        except Exception as e:
            print(f"Could not spawn app, trying to attach to running app: {str(e)}")
            
        # Attach to the running app
        try:
            # First try with the spawned PID if available
            if 'pid' in locals():
                session = device.attach(pid)
            else:
                # Otherwise try to find the package by name
                session = device.attach(PACKAGE_NAME)
            print(f"Attached to {PACKAGE_NAME}")
        except Exception as e:
            print(f"Failed to attach: {str(e)}")
            return

        # Load the script
        with open(SCRIPT_PATH, 'r', encoding='utf-8') as f:
            script_content = f.read()
            
        script = session.create_script(script_content)
        script.on('message', on_message)
        script.load()
        print("Script loaded. Logging network traffic...")
        
        # Keep the script running
        print("Press Ctrl+C to stop logging")
        sys.stdin.read()
        
    except KeyboardInterrupt:
        print("\nExiting...")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
