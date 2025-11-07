/**
 * SimpleModule.c - Example native PE/DLL module
 * 
 * Compile as DLL:
 *   cl.exe /LD /Fe:SimpleModule.dll SimpleModule.c user32.lib
 * 
 * Compile as EXE:
 *   cl.exe /Fe:SimpleModule.exe SimpleModule.c user32.lib
 */

#include <windows.h>
#include <stdio.h>

// Export function that can be called as entry point
__declspec(dllexport) int Execute(int argc, char** argv) {
    char message[512];
    
    // Build message with arguments
    if (argc > 1) {
        snprintf(message, sizeof(message), 
                "Module executed with %d arguments:\n", argc - 1);
        
        for (int i = 1; i < argc && i < 10; i++) {
            char arg[100];
            // Safely truncate long arguments to prevent buffer overflow
            if (strlen(argv[i]) > 80) {
                snprintf(arg, sizeof(arg), "  arg[%d]: %.80s...\n", i, argv[i]);
            } else {
                snprintf(arg, sizeof(arg), "  arg[%d]: %s\n", i, argv[i]);
            }
            // Safely concatenate with bounds checking
            size_t remaining = sizeof(message) - strlen(message) - 1;
            if (remaining > strlen(arg)) {
                strncat(message, arg, remaining);
            }
        }
    } else {
        snprintf(message, sizeof(message), 
                "Module executed with no arguments\n\nThis is a simple example module.");
    }
    
    // Display message box
    MessageBoxA(NULL, message, "Simple Module", MB_OK | MB_ICONINFORMATION);
    
    // Return success
    return 0;
}

// Standard DLL entry point (optional)
BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpvReserved) {
    switch (fdwReason) {
        case DLL_PROCESS_ATTACH:
            // Module loaded
            break;
        case DLL_PROCESS_DETACH:
            // Module unloaded
            break;
    }
    return TRUE;
}

// Main entry point for EXE version
#ifdef COMPILE_AS_EXE
int main(int argc, char** argv) {
    return Execute(argc, argv);
}
#endif
