# Module Examples

This directory contains example modules demonstrating the reflective module loading capabilities.

## Module Types

### 1. PE/DLL Modules
Native Windows executables and libraries that can be loaded reflectively.

### 2. .NET Assemblies
Managed .NET code compiled to DLL or EXE.

### 3. Shellcode
Position-independent code for direct execution.

## Creating Modules

See MODULE_LOADING.md in the project root for detailed instructions.

## Security Notice

⚠️ **Warning**: These modules execute with the same privileges as the client process. Always test in isolated environments first.
