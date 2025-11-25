#!/usr/bin/python3
# -*- coding: utf-8 -*-

import json
import os
import platform
import shutil
import sys
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from subprocess import call, STDOUT, Popen, list2cmdline
try:
    from subprocess import DEVNULL
except ImportError:
    import os
    DEVNULL = open(os.devnull, 'wb')


const_dir_tmp = ".xapk_debug_tmp"
const_ext_apk = ".apk"
const_ext_xapk = ".xapk"
const_ext_zip = ".zip"

const_file_xapk_manifest = "manifest.json"
const_file_xapk_manifest_key_package_name = "package_name"
const_file_xapk_manifest_key_split_apks = "split_apks" # Key for split APKs in manifest

const_prefix_apk_split_type_config = "config"
const_suffix_apk_split_type_dpi = "dpi"
const_values_apk_split_type_arch = [ "arm64_v8a", "armeabi_v7a", "armeabi", "x86", "x86_64" ]

const_split_apk_type_main = "main"
const_split_apk_type_arch = "arch"
const_split_apk_type_dpi = "dpi"
const_split_apk_type_locale = "locale"

const_sign_config_properties_file = 'xapktoapk_debug.sign.properties' # Renamed sign config file

# XML Namespace for Android
ANDROID_NAMESPACE = 'http://schemas.android.com/apk/res/android'
# Register the namespace to ensure proper attribute handling when parsing/writing XML
ET.register_namespace('android', ANDROID_NAMESPACE)

def print_help():
    print("")
    print("XapkToDebugXapk is a tool that takes an .xapk file and outputs a debuggable .xapk file.")
    print("It decompiles the base APK, sets the debuggable flag, recompiles, and re-signs all APKs within the XAPK.")
    print("Usage: python xapk_to_debug_xapk.py PATH_TO_FILE.xapk")
    print("\nTo enable signing, create a file named 'xapktoapk_debug.sign.properties' in the same directory or your home directory with:")
    print("sign.enabled=true")
    print("sign.keystore.file=/path/to/your/debug.keystore")
    print("sign.keystore.password=android")
    print("sign.key.alias=androiddebugkey")
    print("sign.key.password=android")
    print("")


def get_param_xapk_file_name():
    return sys.argv[1]


def get_param_xapk_abs_path():
    return os.path.abspath(get_param_xapk_file_name())


def check_sys_args():
    if len(sys.argv) != 2:
        return False
    xapk_file_name = get_param_xapk_file_name()
    if not xapk_file_name.endswith(const_ext_xapk):
        return False
    abspath_to_xapk_file = os.path.abspath(xapk_file_name)
    if not os.path.exists(abspath_to_xapk_file):
        return False
    return True


def execute_command_subprocess(command_tokens_list):
    """Executes a shell command and returns the return code."""
    print(f"Executing: {' '.join(command_tokens_list)}")
    rc = call(command_tokens_list, stdout=DEVNULL, stderr=STDOUT)
    return rc


def is_windows():
    return platform.system() == "Windows"


def windows_hide_file(file_path):
    execute_command_subprocess(["attrib", "+h", file_path])


def create_or_recreate_dir(dir_path):
    """Creates a directory, removing it first if it exists."""
    if os.path.exists(dir_path):
        if os.path.isdir(dir_path):
            shutil.rmtree(dir_path)
        else:
            os.remove(dir_path)
    os.mkdir(dir_path)
    if is_windows():
        windows_hide_file(dir_path)


def check_if_executable_exists_in_path(executable):
    """Checks if an executable is found in the system's PATH."""
    path_to_cmd = shutil.which(executable)
    return path_to_cmd is not None

def get_executable_in_path(executable):
    """Returns the full path to an executable if found in PATH."""
    return shutil.which(executable)

def get_path_to_batch(batch):
    """Gets the path to a .bat executable on Windows."""
    if not is_windows():
        return None
    paths = os.environ['PATH'].split(os.pathsep)
    name = batch + ".bat"
    for path in paths:
        if os.path.isfile(os.path.join(path, name)):
            return os.path.join(path, name)
    return None

def create_tmp_dir(working_dir):
    """Creates and returns the path to a temporary working directory."""
    path_dir_tmp = os.path.abspath(os.path.join(working_dir, const_dir_tmp))
    create_or_recreate_dir(path_dir_tmp)
    return path_dir_tmp


def file_split_name_and_extension(file_path):
    """Splits a file path into its name and extension."""
    split = os.path.splitext(file_path)
    return split[0], split[1]


def determine_split_type_by_apk_file_name(apk_file_name, xapk_package_name):
    """Determines the type of APK (main, arch, dpi, locale) based on its filename."""
    apk_type = None
    try:
        if (xapk_package_name + const_ext_apk) == apk_file_name or 'base.apk' == apk_file_name:
            apk_type = const_split_apk_type_main
        elif apk_file_name.startswith(const_prefix_apk_split_type_config):
            clear_file_name = os.path.splitext(apk_file_name)[0]
            clear_file_name_splitted = clear_file_name.split('.')
            config_name = str(clear_file_name_splitted[1])
            if config_name.endswith(const_suffix_apk_split_type_dpi):
                apk_type = const_split_apk_type_dpi
            elif config_name in const_values_apk_split_type_arch:
                apk_type = const_split_apk_type_arch
            else:
                apk_type = const_split_apk_type_locale
        else:
            apk_type = const_split_apk_type_locale
    except:
        pass
    return apk_type


def unpack_apk(path_apk_file, output_dir, number_current, number_total):
    """Decompiles an APK using apktool."""
    print(f'[*] Unpacking {os.path.basename(path_apk_file)} ({number_current} of {number_total})')
    
    apktool = get_executable_in_path('apktool')
    if not apktool:
        apktool = get_path_to_batch('apktool')
        if not apktool:
            raise Exception("apktool executable not found. Please ensure it's in your PATH.")

    # Apktool needs to be run from the directory where the APK is, or use absolute paths for output
    original_cwd = os.getcwd()
    os.chdir(os.path.dirname(path_apk_file))

    # The -o flag directly specifies the output directory, preventing "cwd" issues
    rc = execute_command_subprocess([apktool, 'd', '-s', os.path.basename(path_apk_file), '-o', output_dir])
    
    os.chdir(original_cwd) # Change back to original working directory

    if rc != 0:
        raise Exception(f"Failed to unpack {os.path.basename(path_apk_file)}. Apktool return code: {rc}")
    
    if not os.path.exists(output_dir):
        raise Exception(f"Apktool unpacked to {output_dir} but directory not found!")
    
    os.remove(path_apk_file) # Remove the original APK file after unpacking


def update_apk_manifest_for_debug(apk_dir_path):
    """Modifies the AndroidManifest.xml to set android:debuggable="true"."""
    path_manifest = os.path.join(apk_dir_path, 'AndroidManifest.xml')
    print(f'[*] Modifying AndroidManifest.xml for debuggable flag in: {path_manifest}')

    try:
        tree = ET.parse(path_manifest)
        root = tree.getroot()

        # Find the <application> tag
        application_tag = root.find('application')

        if application_tag is not None:
            # Set android:debuggable="true"
            debuggable_attr = '{' + ANDROID_NAMESPACE + '}debuggable'
            application_tag.set(debuggable_attr, 'true')
            print(f"    Set {debuggable_attr} to 'true' in {os.path.basename(apk_dir_path)}.")
        else:
            print("    <application> tag not found in manifest. Skipping debuggable flag modification.")

        replacements_for_main_apk = {
            'com.android.vending.splits.required': '',
            'com.android.vending.splits': '',
            'com.google.android.stamp.type': '',
        }

        # Collect meta-data tags to remove or modify
        meta_data_to_remove = []
        for meta_data in root.findall(".//meta-data"):
            name_attr = '{' + ANDROID_NAMESPACE + '}name'
            value_attr = '{' + ANDROID_NAMESPACE + '}value'

            meta_data_name = meta_data.get(name_attr)

            if meta_data_name in replacements_for_main_apk:
                if meta_data_name == 'com.google.android.stamp.type':
                    meta_data.set(value_attr, 'STAMP_TYPE_STANDALONE_APK')
                    print("    Modified 'com.google.android.stamp.type' to 'STAMP_TYPE_STANDALONE_APK'.")
                else:
                    # Mark for removal, don't remove during iteration
                    meta_data_to_remove.append(meta_data)
                    print(f"    Marked meta-data tag for removal: {meta_data_name}.")

        # Now, remove the marked meta-data tags after the iteration is complete
        for meta_data_tag in meta_data_to_remove:
            # You need to find the parent of the meta_data_tag to remove it.
            # In AndroidManifest, meta-data tags are typically direct children of <application>
            if application_tag is not None:
                application_tag.remove(meta_data_tag)
            # If for some reason it's directly under root (unlikely for app bundles), you might need:
            # else:
            #     root.remove(meta_data_tag) # This path is less common for meta-data tags

        # Remove 'android:isSplitRequired' and 'android:requiredSplitTypes' attributes from the manifest tag itself
        manifest_tag = root # The root is the manifest tag
        is_split_required_attr = '{' + ANDROID_NAMESPACE + '}isSplitRequired'
        required_split_types_attr = '{' + ANDROID_NAMESPACE + '}requiredSplitTypes'
        split_types_attr = '{' + ANDROID_NAMESPACE + '}splitTypes'

        if is_split_required_attr in manifest_tag.attrib:
            del manifest_tag.attrib[is_split_required_attr]
            print("    Removed 'android:isSplitRequired' attribute.")
        if required_split_types_attr in manifest_tag.attrib:
            del manifest_tag.attrib[required_split_types_attr]
            print("    Removed 'android:requiredSplitTypes' attribute.")
        if split_types_attr in manifest_tag.attrib:
            del manifest_tag.attrib[split_types_attr]
            print("    Removed 'android:splitTypes' attribute.")

        # Save the modified XML back to the file
        tree.write(path_manifest, encoding='utf-8', xml_declaration=True)
        print(f'[*] AndroidManifest.xml updated successfully.')

    except Exception as e:
        print(f"Error modifying manifest for {os.path.basename(apk_dir_path)}: {e}")
        raise

def pack_apk(apk_dir_path, output_apk_path):
    """Recompiles an APK directory back into an APK file."""
    print(f'[*] Recompiling {os.path.basename(apk_dir_path)} to {os.path.basename(output_apk_path)}')
    
    apktool = get_executable_in_path('apktool')
    if not apktool:
        apktool = get_path_to_batch('apktool')
        if not apktool:
            raise Exception("apktool executable not found. Please ensure it's in your PATH.")

    # Apktool rebuilds to 'apk_dir_path/dist/apk_dir_name.apk'
    rc = execute_command_subprocess([apktool, 'b', apk_dir_path, '-o', output_apk_path])

    if rc != 0:
        raise Exception(f"Failed to repack APK from {os.path.basename(apk_dir_path)}. Apktool return code: {rc}")
    
    if not os.path.exists(output_apk_path):
        raise Exception(f"Apktool failed to create the output APK at {output_apk_path}")


def zipalign_apk(apk_file_path):
    """Zipaligns an APK file."""
    print(f'[*] Zipaligning {os.path.basename(apk_file_path)}')
    
    aligned_apk_file_path = apk_file_path + '.aligned'
    
    rc = execute_command_subprocess(['zipalign', '-p', '-f', '4', apk_file_path, aligned_apk_file_path])
    if rc != 0:
        raise Exception(f"Failed to zipalign {os.path.basename(apk_file_path)}. Zipalign return code: {rc}")
    if not os.path.exists(aligned_apk_file_path):
        raise Exception(f"Zipalign failed to create the aligned APK at {aligned_apk_file_path}")

    os.remove(apk_file_path)
    shutil.move(aligned_apk_file_path, apk_file_path)


def sign_apk(apk_file_path, sign_config):
    """Signs an APK file using apksigner."""
    print(f'[*] Signing {os.path.basename(apk_file_path)}')
    
    apksigner = get_executable_in_path('apksigner')
    if not apksigner:
        apksigner = get_path_to_batch('apksigner')
        if not apksigner:
            raise Exception("apksigner executable not found. Please ensure it's in your PATH.")

    command = [
        apksigner, 'sign',
        '--ks', os.path.expanduser(sign_config['sign.keystore.file']),
        '--ks-pass', f'pass:{sign_config["sign.keystore.password"]}',
        '--ks-key-alias', sign_config['sign.key.alias'],
        '--key-pass', f'pass:{sign_config["sign.key.password"]}',
        apk_file_path
    ]
    rc = execute_command_subprocess(command)
    if rc != 0:
        raise Exception(f"Failed to sign {os.path.basename(apk_file_path)}. Apksigner return code: {rc}")


def delete_signature_related_files(apk_dir_path):
    """Deletes old signature files to prevent conflicts during recompilation and re-signing."""
    print(f'[*] Deleting old signature files in {os.path.basename(apk_dir_path)}')
    meta_inf_dir = os.path.join(apk_dir_path, 'META-INF')
    if os.path.exists(meta_inf_dir) and os.path.isdir(meta_inf_dir):
        for item in os.listdir(meta_inf_dir):
            if item.endswith(('.RSA', '.SF', '.MF')):
                file_to_delete = os.path.join(meta_inf_dir, item)
                print(f"    Deleting {file_to_delete}")
                os.remove(file_to_delete)
    
    # Remove stamp-cert-sha256 from unknown/original if it exists
    # Apktool usually handles this, but good to be explicit
    unknown_stamp_path = os.path.join(apk_dir_path, 'unknown', 'stamp-cert-sha256')
    if os.path.exists(unknown_stamp_path):
        os.remove(unknown_stamp_path)
        print(f"    Deleted {unknown_stamp_path}")
    original_stamp_path = os.path.join(apk_dir_path, 'original', 'stamp-cert-sha256')
    if os.path.exists(original_stamp_path):
        os.remove(original_stamp_path)
        print(f"    Deleted {original_stamp_path}")


def load_sign_properties():
    """Loads signing properties from a configuration file."""
    path_sign_config_file = os.path.abspath(os.path.join(os.getcwd(), const_sign_config_properties_file))
    if not os.path.exists(path_sign_config_file):
        path_sign_config_file = os.path.abspath(os.path.join(os.path.expanduser('~'), const_sign_config_properties_file))
        if not os.path.exists(path_sign_config_file):
            print("Signing configuration file not found (looked in current and home directory). Signing will be skipped unless explicitly enabled.")
            return None

    sign_config_file_lines = []
    with open(path_sign_config_file, 'r', encoding='UTF-8') as sign_config_file:
        sign_config_file_lines = sign_config_file.readlines()

    properties = {}
    for line in sign_config_file_lines:
        checked_line = line.strip()
        if not checked_line or checked_line.startswith('#'):
            continue
        line_parts = checked_line.split('=')
        if len(line_parts) == 2:
            property_key = line_parts[0].strip()
            property_value = line_parts[1].strip()
            properties[property_key] = property_value

    if not properties.get('sign.enabled', '').lower() == 'true':
        print("Signing is disabled in configuration, skipping signing process.")
        return None
        
    required_keys = ['sign.keystore.file', 'sign.keystore.password', 'sign.key.alias', 'sign.key.password']
    for key in required_keys:
        if not properties.get(key):
            print(f"Missing required signing property: {key}. Skipping signing process.")
            return None

    keystore_file = os.path.expanduser(properties['sign.keystore.file'])
    if not os.path.exists(keystore_file) or os.path.isdir(keystore_file):
        print(f"Keystore file not found or invalid: {keystore_file}. Skipping signing process.")
        return None

    print(f"Loaded signing properties: {properties}")
    return properties


def main():
    if not check_sys_args():
        print_help()
        exit(-1)

    print('[*] Checking tool dependencies...')
    for tool in ["apktool", "zipalign", "apksigner"]:
        if not check_if_executable_exists_in_path(tool) and get_path_to_batch(tool) is None:
            print(f"Error: executable '{tool}' not found in your system's PATH. Please install it or add its directory to PATH.")
            exit(-2)

    sign_properties = load_sign_properties()
    should_sign_apks = sign_properties is not None

    xapk_file_name = get_param_xapk_file_name()
    xapk_file_abs_path = get_param_xapk_abs_path()
    original_file_name, _ = file_split_name_and_extension(xapk_file_name)

    print(f'[*] Starting XAPK to Debug XAPK conversion for: {xapk_file_name}')
    cwd = os.path.abspath(os.path.curdir)

    path_dir_tmp = create_tmp_dir(cwd)
    
    # Unpack XAPK (which is just a zip file)
    path_target_file_zip = os.path.join(path_dir_tmp, os.path.basename(xapk_file_abs_path).replace(const_ext_xapk, const_ext_zip))
    shutil.copy(xapk_file_abs_path, path_target_file_zip)
    
    print('[*] Unpacking XAPK to temporary directory...')
    with ZipFile(path_target_file_zip, 'r') as zip_file:
        zip_file.extractall(path=path_dir_tmp)
    os.remove(path_target_file_zip) # Remove the copied zip file

    # Parse XAPK manifest to get APK names
    xapk_manifest_data = None
    path_xapk_manifest = os.path.join(path_dir_tmp, const_file_xapk_manifest)
    if not os.path.exists(path_xapk_manifest):
        raise Exception(f"XAPK manifest file not found: {path_xapk_manifest}")
    with open(path_xapk_manifest, 'r') as file:
        xapk_manifest_data = json.load(file)
    xapk_package_name = xapk_manifest_data[const_file_xapk_manifest_key_package_name]

    # Collect all APKs within the unpacked XAPK structure
    target_apk_files = []
    # The main APK is usually 'base.apk' or '<package_name>.apk' at the root
    # Other split APKs are listed in the manifest or are also at the root.
    
    # First, list all .apk files directly in the temp directory
    for file in os.listdir(path_dir_tmp):
        if file.endswith(const_ext_apk):
            target_apk_files.append(file)
    
    # If the manifest specifies split_apks, ensure those are also processed
    if const_file_xapk_manifest_key_split_apks in xapk_manifest_data:
        for split_apk_entry in xapk_manifest_data[const_file_xapk_manifest_key_split_apks]:
            apk_path_in_xapk = split_apk_entry.get('file')
            if apk_path_in_xapk and apk_path_in_xapk not in target_apk_files:
                target_apk_files.append(apk_path_in_xapk)


    if not target_apk_files:
        raise Exception("No APK files found inside the XAPK. Cannot proceed.")

    # Prepare data structure for each APK
    apks_to_process = {}
    for apk_file_name in target_apk_files:
        apk_file_path = os.path.abspath(os.path.join(path_dir_tmp, apk_file_name))
        apk_dir_name = os.path.splitext(apk_file_name)[0]
        apk_dir_path = os.path.abspath(os.path.join(path_dir_tmp, apk_dir_name))
        apk_type = determine_split_type_by_apk_file_name(apk_file_name, xapk_package_name)
        if apk_type is None:
            print(f"Warning: Could not determine split type for {apk_file_name}. Treating as a regular split APK.")
            apk_type = "unknown_split" # Or handle as error if strict

        apks_to_process[apk_file_name] = {
            'apk_file_name': apk_file_name,
            'apk_file_path': apk_file_path,
            'apk_dir_name': apk_dir_name,
            'apk_dir_path': apk_dir_path,
            'apk_split_type': apk_type
        }
    
    print(f'[*] XAPK unpacked. {len(apks_to_process)} APK parts discovered.')

    # Decompile all APKs
    unpack_number_total = len(apks_to_process)
    for index, apk_key in enumerate(apks_to_process.keys()):
        apk_entry = apks_to_process[apk_key]
        unpack_apk(apk_entry['apk_file_path'], apk_entry['apk_dir_path'], index + 1, unpack_number_total)

    # Process each decompiled APK
    for apk_key in apks_to_process.keys():
        apk_entry = apks_to_process[apk_key]
        print(f"--- Processing {apk_entry['apk_file_name']} ({apk_entry['apk_split_type']}) ---")
        
        # Always delete existing signatures before recompiling and re-signing
        delete_signature_related_files(apk_entry['apk_dir_path'])

        # Only modify the manifest for the main/base APK
        if apk_entry['apk_split_type'] == const_split_apk_type_main:
            update_apk_manifest_for_debug(apk_entry['apk_dir_path'])
        else:
            print(f"[*] Skipping manifest modification for {apk_entry['apk_file_name']} (not main APK).")

        # Recompile the APK
        # Apktool rebuilds into <apk_dir_path>/dist/<apk_dir_name>.apk
        repacked_apk_name = apk_entry['apk_dir_name'] + const_ext_apk
        repacked_apk_path = os.path.join(apk_entry['apk_dir_path'], 'dist', repacked_apk_name)
        
        # Clean up existing 'dist' directory if it exists to avoid old files
        dist_dir = os.path.join(apk_entry['apk_dir_path'], 'dist')
        if os.path.exists(dist_dir):
            shutil.rmtree(dist_dir)
        os.makedirs(dist_dir) # Recreate dist directory

        pack_apk(apk_entry['apk_dir_path'], repacked_apk_path)
        
        # Move the repacked APK to the temporary working directory for zipalign/sign
        final_apk_in_tmp = os.path.join(path_dir_tmp, apk_entry['apk_file_name'])
        shutil.move(repacked_apk_path, final_apk_in_tmp)
        
        # Update the apk_file_path in the dict to point to the newly packed APK
        apks_to_process[apk_key]['apk_file_path'] = final_apk_in_tmp
        
        # Zipalign the repacked APK
        zipalign_apk(final_apk_in_tmp)

        # Sign the repacked and zipaligned APK
        if should_sign_apks:
            sign_apk(final_apk_in_tmp, sign_properties)
        else:
            print(f"[*] Skipping signing for {apk_entry['apk_file_name']} (signing disabled).")
        
        print(f"--- Finished processing {apk_entry['apk_file_name']} ---")
        print("")

    # Repackage all processed APKs into a new XAPK
    output_xapk_name = f"{original_file_name}_debuggable{const_ext_xapk}"
    output_xapk_path = os.path.join(cwd, output_xapk_name)

    print(f'[*] Repackaging all modified APKs into {output_xapk_name}')
    with ZipFile(output_xapk_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as xapk_zip:
        # Add the manifest.json
        xapk_zip.write(path_xapk_manifest, arcname=const_file_xapk_manifest)
        
        # Add all the recompiled and re-signed APKs
        for apk_key in apks_to_process.keys():
            apk_entry = apks_to_process[apk_key]
            # The arcname must be the original APK filename within the XAPK
            xapk_zip.write(apk_entry['apk_file_path'], arcname=apk_entry['apk_file_name'])
            print(f"    Added {apk_entry['apk_file_name']} to new XAPK.")

    print(f'[+] Successfully created debuggable XAPK: {output_xapk_path}')

    # Clean up temporary directory
    print('[*] Cleaning up temporary files...')
    os.chdir(cwd)
    shutil.rmtree(path_dir_tmp)

    print('[*] Complete!')


if __name__ == '__main__':
    import zipfile # Import zipfile here to ensure it's available for compression level
    main()