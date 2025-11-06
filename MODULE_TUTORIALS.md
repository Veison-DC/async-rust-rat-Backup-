# Module Loading Tutorials

Complete step-by-step tutorials for using the in-memory reflective module loading feature.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Loading Your First Module](#loading-your-first-module)
3. [Working with PE/DLL Modules](#working-with-pedll-modules)
4. [Working with .NET Assemblies](#working-with-net-assemblies)
5. [Working with Shellcode](#working-with-shellcode)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Topics](#advanced-topics)

---

## Getting Started

### Prerequisites

- Server connected to target client
- Module files (.dll, .exe, or .bin)
- Basic understanding of module types

### UI Access

1. Navigate to the Module Manager in the client interface
2. Select the target client from the client list
3. Open the Module Manager tab

---

## Loading Your First Module

### Step 1: Prepare Your Module

Choose or create a simple module for testing. For this tutorial, we'll use the example `SystemInfo.cs` assembly.

**Build the example:**
```batch
cd examples\modules
csc /target:exe /out:SystemInfo.exe SystemInfo.cs
```

### Step 2: Load the Module via UI

1. Click the **"Load Module"** button
2. Fill in the form:
   - **Module File:** Browse to `SystemInfo.exe`
   - **Module ID:** `sysinfo_v1` (auto-generated)
   - **Module Name:** `System Information`
   - **Module Type:** Select `.NET Assembly`
   - **Entry Point:** `Main` (optional)
   - **Description:** `Gather system information`
3. Click **"Load Module"**

The module will be transferred to the client and stored in memory.

### Step 3: Execute the Module

1. Select the loaded module from the list
2. Click **"Execute Module"**
3. Enter arguments (optional): `--detailed`
4. Set timeout: `60` seconds
5. Click **"Execute"**

### Step 4: View Results

Results appear in the **Execution History** panel showing:
- Success/failure status
- Output text
- Exit code
- Any errors

---

## Working with PE/DLL Modules

### Creating a Simple PE Module

**Example: MessageBox DLL**

```c
// message.c
#include <windows.h>

__declspec(dllexport) int Execute(int argc, char** argv) {
    char message[256];
    
    if (argc > 1) {
        snprintf(message, sizeof(message), "Hello from module!\nArg: %s", argv[1]);
    } else {
        snprintf(message, sizeof(message), "Hello from module!");
    }
    
    MessageBoxA(NULL, message, "Module Test", MB_OK);
    return 0;
}

BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpvReserved) {
    return TRUE;
}
```

**Compile:**
```batch
cl /LD /MD /Fe:message.dll message.c user32.lib
```

### Loading PE Module via UI

1. Click **"Load Module"**
2. Select `message.dll`
3. Set **Module Type** to `PE/DLL`
4. Set **Entry Point** to `Execute`
5. Add description: `Display message box`
6. Click **"Load Module"**

### Executing with Arguments

1. Select the module
2. Click **"Execute Module"**
3. Enter arguments: `TestMessage`
4. Click **"Execute"**

The module will execute on the client and display a message box.

---

## Working with .NET Assemblies

### Creating a .NET Assembly Module

**Example: Registry Scanner**

```csharp
// RegistryScanner.cs
using System;
using Microsoft.Win32;

public class RegistryScanner
{
    public static void Main(string[] args)
    {
        Console.WriteLine("=== Registry Scanner ===\n");
        
        string path = args.Length > 0 ? args[0] : @"Software\Microsoft";
        
        try
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(path))
            {
                if (key != null)
                {
                    Console.WriteLine($"Scanning: HKCU\\{path}\n");
                    
                    // List subkeys
                    Console.WriteLine("Subkeys:");
                    foreach (string subkeyName in key.GetSubKeyNames())
                    {
                        Console.WriteLine($"  {subkeyName}");
                    }
                    
                    // List values
                    Console.WriteLine("\nValues:");
                    foreach (string valueName in key.GetValueNames())
                    {
                        object value = key.GetValue(valueName);
                        Console.WriteLine($"  {valueName} = {value}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }
}
```

**Compile:**
```batch
csc /target:exe /out:RegistryScanner.exe RegistryScanner.cs
```

### Loading via UI

1. **Module File:** `RegistryScanner.exe`
2. **Module Type:** `.NET Assembly`
3. **Entry Point:** `Main`
4. **Description:** `Scan Windows Registry`

### Execute with Registry Path

Arguments: `Software\Microsoft\Windows\CurrentVersion`

---

## Working with Shellcode

### Creating Simple Shellcode

Shellcode is position-independent code, typically created with tools like `msfvenom` or custom assembly.

**Example: Create calc.exe shellcode with msfvenom:**
```bash
msfvenom -p windows/exec CMD=calc.exe -f raw > calc.bin
```

### Loading Shellcode

1. **Module File:** `calc.bin`
2. **Module Type:** `Shellcode`
3. **Entry Point:** (leave empty)
4. **Description:** `Launch calculator`

### Execute

No arguments needed for simple shellcode. Just execute with appropriate timeout.

⚠️ **Warning:** Only use shellcode from trusted sources. Verify integrity before execution.

---

## Best Practices

### 1. Module Organization

**Use descriptive IDs:**
```
Good: credential_dumper_v2.1
Bad:  mod1
```

**Categorize modules:**
```
recon_network_scanner_v1
persist_registry_v1
exfil_file_transfer_v2
```

### 2. Testing

Always test modules in isolated environments first:

1. Load module in test VM
2. Execute with test arguments
3. Verify output
4. Check for errors
5. Deploy to production

### 3. Security

**Hash Verification:**
- Module hashes are logged automatically
- Keep a database of known-good hashes
- Verify before executing

**Argument Sanitization:**
- Arguments are automatically sanitized
- Avoid passing sensitive data in arguments
- Use timeouts appropriately

### 4. Resource Management

**Module Lifecycle:**
```javascript
// Load
load_module(...)

// Use multiple times
execute_module(...) // First use
execute_module(...) // Second use

// Cleanup when done
unload_module(...)
```

**Memory Considerations:**
- Maximum module size: 50MB (configurable)
- Unload unused modules
- Monitor client memory usage

### 5. Error Handling

**Check execution results:**
```javascript
// Listen for results
listen('module-execution-result', (event) => {
  if (!event.payload.success) {
    console.error('Module failed:', event.payload.error);
    // Handle failure
  } else {
    console.log('Output:', event.payload.output);
    // Process success
  }
});
```

---

## Troubleshooting

### Module Won't Load

**Problem:** "Failed to load module" error

**Solutions:**
1. Check file path is correct
2. Verify file is not corrupted
3. Check module size < 50MB
4. Ensure proper module type selected

### Module Won't Execute

**Problem:** Module loads but won't execute

**Solutions:**
1. Verify module is loaded (check loaded modules list)
2. Check timeout is sufficient
3. Verify entry point is correct (case-sensitive)
4. Review execution history for errors

### No Output Returned

**Problem:** Module executes but no output

**Solutions:**
1. Check execution history panel
2. Increase timeout value
3. Verify module produces output
4. Check for network issues

### .NET Assembly Fails

**Problem:** .NET assembly won't execute

**Solutions:**
1. Verify .NET Framework 4.0+ is installed on client
2. Check entry point name is correct
3. Ensure assembly is compiled for correct architecture (x86/x64)
4. Review CLR hosting errors in logs

---

## Advanced Topics

### Custom Module Development

**Best Practices for Custom Modules:**

1. **Keep modules small** - Under 5MB when possible
2. **Minimize dependencies** - Fewer DLLs = more reliable
3. **Error handling** - Always handle exceptions
4. **Clean exit** - Return proper exit codes
5. **Documentation** - Document arguments and behavior

### Module Chaining

Execute multiple modules in sequence:

```javascript
// Phase 1: Reconnaissance
await loadModule('network_scanner');
await executeModule('network_scanner', ['--quick']);

// Phase 2: Enumeration
await loadModule('user_enum');
await executeModule('user_enum', []);

// Phase 3: Cleanup
await unloadModule('network_scanner');
await unloadModule('user_enum');
```

### Parameter Marshaling

**For .NET assemblies:**
```csharp
public static void Main(string[] args)
{
    if (args.Length < 2) {
        Console.WriteLine("Usage: module <command> <target>");
        return;
    }
    
    string command = args[0];
    string target = args[1];
    
    // Process...
}
```

**Execute with:**
```
Arguments: scan 192.168.1.0/24
```

### Output Capture

Modules can produce output via:
- `Console.WriteLine()` (.NET)
- `printf()` (C/C++)
- Return values

All output is captured and sent to the server.

### Security Policies

Configure module security (future feature):

```javascript
// Set security policy
{
  maxModuleSize: 25 * 1024 * 1024,  // 25MB
  enforceTimeout: true,
  maxTimeoutSeconds: 120,
  requireSignature: false  // Future feature
}
```

---

## Example Workflows

### Workflow 1: System Reconnaissance

```
1. Load SystemInfo.exe
2. Execute with --detailed flag
3. Review output for OS version, IP addresses
4. Load network_scanner.dll
5. Execute with discovered network range
6. Unload both modules
```

### Workflow 2: Credential Access

```
1. Load credential_dumper.exe
2. Execute with --browser flag
3. Review extracted credentials
4. Load password_spray.dll
5. Execute with discovered usernames
6. Cleanup and unload
```

### Workflow 3: Persistence

```
1. Load persistence_installer.dll
2. Execute with --registry method
3. Verify installation in logs
4. Unload module
```

---

## Additional Resources

- [MODULE_LOADING.md](../MODULE_LOADING.md) - Complete API reference
- [QUICKSTART_MODULES.md](../QUICKSTART_MODULES.md) - Quick start guide
- [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) - Technical details
- [examples/modules/](../examples/modules/) - Example module source code

---

## Support

For issues or questions:
1. Check documentation
2. Review example modules
3. Test in isolated environment
4. Create GitHub issue with details

---

**Happy module loading! Remember to always test in isolated environments first.** 🚀
