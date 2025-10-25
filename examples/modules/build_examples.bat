@echo off
REM Build script for example modules
REM Requires Visual Studio and .NET Framework/SDK to be installed

echo Building example modules...
echo.

REM Check for C# compiler
where csc >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: csc not found. Skipping .NET module compilation.
    echo Add .NET Framework to PATH or run from Visual Studio Developer Command Prompt.
    echo.
) else (
    echo Building .NET Assembly: SystemInfo.exe
    csc /target:exe /out:SystemInfo.exe SystemInfo.cs
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] SystemInfo.exe built successfully
    ) else (
        echo [FAILED] SystemInfo.exe compilation failed
    )
    echo.
)

REM Check for C compiler
where cl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: cl.exe not found. Skipping native module compilation.
    echo Run from Visual Studio Developer Command Prompt.
    echo.
) else (
    echo Building PE DLL: SimpleModule.dll
    cl /LD /Fe:SimpleModule.dll SimpleModule.c user32.lib /link /NODEFAULTLIB:libcmt.lib
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] SimpleModule.dll built successfully
    ) else (
        echo [FAILED] SimpleModule.dll compilation failed
    )
    echo.
    
    echo Building PE EXE: SimpleModule.exe
    cl /DCOMPILE_AS_EXE /Fe:SimpleModuleExe.exe SimpleModule.c user32.lib
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] SimpleModuleExe.exe built successfully
    ) else (
        echo [FAILED] SimpleModuleExe.exe compilation failed
    )
    echo.
)

REM Cleanup intermediate files
echo Cleaning up intermediate files...
del *.obj 2>nul
del *.exp 2>nul
del *.lib 2>nul

echo.
echo Build process completed!
echo.
echo Built modules can be loaded using the module loading API.
echo See MODULE_LOADING.md for usage instructions.

pause
