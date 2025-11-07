use common::packets::{NetworkConnection, FirewallRule, FirewallDirection, FirewallAction, RouteRedirect, Process};
use std::process::Command;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;

/// Get network connections for a specific process ID
pub fn get_process_connections(pid: usize) -> Vec<NetworkConnection> {
    let mut connections = Vec::new();
    
    // Use netstat to get network connections
    // netstat -ano lists all connections with PID
    let output = match Command::new("netstat")
        .args(&["-ano"])
        .output()
    {
        Ok(output) => output,
        Err(e) => {
            println!("Failed to execute netstat: {}", e);
            return connections;
        }
    };
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    
    // Parse netstat output
    for line in output_str.lines() {
        let line = line.trim();
        
        // Skip header lines
        if line.starts_with("Active") || line.starts_with("Proto") || line.is_empty() {
            continue;
        }
        
        // Split by whitespace
        let parts: Vec<&str> = line.split_whitespace().collect();
        
        // Netstat format: Protocol  Local Address  Foreign Address  State  PID
        // Example: TCP    192.168.1.100:5000    93.184.216.34:443    ESTABLISHED    1234
        if parts.len() >= 5 {
            let protocol = parts[0].to_string();
            let local = parts[1];
            let remote = parts[2];
            let state = if protocol == "TCP" && parts.len() >= 5 {
                parts[3].to_string()
            } else {
                String::new()
            };
            let process_pid = if protocol == "TCP" && parts.len() >= 5 {
                parts[4]
            } else if protocol == "UDP" && parts.len() >= 4 {
                parts[3]
            } else {
                continue;
            };
            
            // Check if this connection belongs to our target PID
            if let Ok(conn_pid) = process_pid.parse::<usize>() {
                if conn_pid == pid {
                    // Parse local address and port
                    let (local_address, local_port) = parse_address_port(local);
                    let (remote_address, remote_port) = parse_address_port(remote);
                    
                    connections.push(NetworkConnection {
                        local_address,
                        local_port,
                        remote_address,
                        remote_port,
                        state,
                        protocol,
                    });
                }
            }
        }
    }
    
    connections
}

/// Parse address:port string into separate components
fn parse_address_port(addr_str: &str) -> (String, u16) {
    if let Some(idx) = addr_str.rfind(':') {
        let address = addr_str[..idx].to_string();
        let port = addr_str[idx + 1..].parse::<u16>().unwrap_or(0);
        (address, port)
    } else {
        (addr_str.to_string(), 0)
    }
}

/// Add a firewall rule using netsh command
pub fn add_firewall_rule(rule: &FirewallRule) -> Result<String, String> {
    let action_str = match rule.action {
        FirewallAction::Block => "block",
        FirewallAction::Allow => "allow",
    };
    
    // Handle direction - if Both, we need to create two rules
    let directions = match rule.direction {
        FirewallDirection::Inbound => vec!["in"],
        FirewallDirection::Outbound => vec!["out"],
        FirewallDirection::Both => vec!["in", "out"],
    };
    
    let mut results = Vec::new();
    
    for dir in directions {
        let mut args = vec![
            "advfirewall",
            "firewall",
            "add",
            "rule",
            "name",
            &format!("{}_{}", rule.rule_name, dir),
            "dir",
            dir,
            "action",
            action_str,
        ];
        
        // Add program path if specified
        let program_arg;
        if let Some(ref path) = rule.process_path {
            program_arg = path.clone();
            args.push("program");
            args.push(&program_arg);
        }
        
        // Add remote addresses if specified
        let remote_addr_str;
        if let Some(ref addresses) = rule.remote_addresses {
            if !addresses.is_empty() {
                remote_addr_str = addresses.join(",");
                args.push("remoteip");
                args.push(&remote_addr_str);
            }
        }
        
        // Execute netsh command
        let output = match Command::new("netsh")
            .args(&args)
            .output()
        {
            Ok(output) => output,
            Err(e) => {
                return Err(format!("Failed to execute netsh: {}", e));
            }
        };
        
        let result = String::from_utf8_lossy(&output.stdout).to_string();
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        
        if !output.status.success() {
            return Err(format!("Failed to add firewall rule ({}): {}", dir, error));
        }
        
        results.push(format!("{}: {}", dir, result));
    }
    
    Ok(results.join("\n"))
}

/// Remove a firewall rule using netsh command
pub fn remove_firewall_rule(rule: &FirewallRule) -> Result<String, String> {
    // Handle direction - if Both, we need to remove two rules
    let directions = match rule.direction {
        FirewallDirection::Inbound => vec!["in"],
        FirewallDirection::Outbound => vec!["out"],
        FirewallDirection::Both => vec!["in", "out"],
    };
    
    let mut results = Vec::new();
    
    for dir in directions {
        let rule_name = format!("{}_{}", rule.rule_name, dir);
        
        let args = vec![
            "advfirewall",
            "firewall",
            "delete",
            "rule",
            "name",
            &rule_name,
        ];
        
        // Execute netsh command
        let output = match Command::new("netsh")
            .args(&args)
            .output()
        {
            Ok(output) => output,
            Err(e) => {
                return Err(format!("Failed to execute netsh: {}", e));
            }
        };
        
        let result = String::from_utf8_lossy(&output.stdout).to_string();
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        
        if !output.status.success() {
            // It's okay if rule doesn't exist
            results.push(format!("{}: Rule not found or already removed", dir));
        } else {
            results.push(format!("{}: {}", dir, result));
        }
    }
    
    Ok(results.join("\n"))
}

/// Add a route redirect using route command
pub fn add_route_redirect(redirect: &RouteRedirect) -> Result<String, String> {
    // Validate IP addresses
    if !is_valid_ip(&redirect.target_address) {
        return Err(format!("Invalid target IP address: {}", redirect.target_address));
    }
    if !is_valid_ip(&redirect.redirect_to) {
        return Err(format!("Invalid redirect IP address: {}", redirect.redirect_to));
    }
    
    // Add route command
    // route add <target> mask 255.255.255.255 <redirect_to> [-p for persistent]
    let mut args = vec![
        "add",
        &redirect.target_address,
        "mask",
        "255.255.255.255",
        &redirect.redirect_to,
    ];
    
    // Add -p flag for persistent routes
    if redirect.permanent {
        args.insert(0, "-p");
    }
    
    // Execute route command
    let output = match Command::new("route")
        .args(&args)
        .output()
    {
        Ok(output) => output,
        Err(e) => {
            return Err(format!("Failed to execute route command: {}", e));
        }
    };
    
    let result = String::from_utf8_lossy(&output.stdout).to_string();
    let error = String::from_utf8_lossy(&output.stderr).to_string();
    
    if !output.status.success() {
        return Err(format!("Failed to add route: {}\n{}", result, error));
    }
    
    Ok(format!("Route added successfully: {} -> {}\n{}", 
        redirect.target_address, redirect.redirect_to, result))
}

/// Remove a route redirect using route command
pub fn remove_route_redirect(redirect: &RouteRedirect) -> Result<String, String> {
    // Validate IP address
    if !is_valid_ip(&redirect.target_address) {
        return Err(format!("Invalid target IP address: {}", redirect.target_address));
    }
    
    // Delete route command
    // route delete <target>
    let args = vec![
        "delete",
        &redirect.target_address,
    ];
    
    // Execute route command
    let output = match Command::new("route")
        .args(&args)
        .output()
    {
        Ok(output) => output,
        Err(e) => {
            return Err(format!("Failed to execute route command: {}", e));
        }
    };
    
    let result = String::from_utf8_lossy(&output.stdout).to_string();
    let error = String::from_utf8_lossy(&output.stderr).to_string();
    
    if !output.status.success() {
        return Err(format!("Failed to delete route: {}\n{}", result, error));
    }
    
    Ok(format!("Route deleted successfully: {}\n{}", redirect.target_address, result))
}

/// Validate IP address format (basic check)
fn is_valid_ip(ip: &str) -> bool {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    
    for part in parts {
        if let Ok(num) = part.parse::<u8>() {
            // Valid octet
        } else {
            return false;
        }
    }
    
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_address_port() {
        let (addr, port) = parse_address_port("192.168.1.1:8080");
        assert_eq!(addr, "192.168.1.1");
        assert_eq!(port, 8080);
        
        let (addr, port) = parse_address_port("[::1]:80");
        assert_eq!(addr, "[::1]");
        assert_eq!(port, 80);
    }
    
    #[test]
    fn test_is_valid_ip() {
        assert!(is_valid_ip("192.168.1.1"));
        assert!(is_valid_ip("0.0.0.0"));
        assert!(is_valid_ip("255.255.255.255"));
        assert!(!is_valid_ip("256.1.1.1"));
        assert!(!is_valid_ip("192.168.1"));
        assert!(!is_valid_ip("not.an.ip.address"));
    }
}
