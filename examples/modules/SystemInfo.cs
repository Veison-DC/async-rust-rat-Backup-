// SystemInfo.cs - Example .NET module for gathering system information
// Compile: csc /target:exe /out:SystemInfo.exe SystemInfo.cs

using System;
using System.Net;
using System.Linq;
using System.Management;
using System.Collections.Generic;

namespace ModuleExample
{
    class SystemInfo
    {
        static void Main(string[] args)
        {
            try
            {
                Console.WriteLine("=== System Information Module ===\n");
                
                bool detailed = args.Contains("--detailed");
                
                // Basic system info
                Console.WriteLine("Computer Name: " + Environment.MachineName);
                Console.WriteLine("OS Version: " + Environment.OSVersion);
                Console.WriteLine("User Name: " + Environment.UserName);
                Console.WriteLine("Domain: " + Environment.UserDomainName);
                Console.WriteLine(".NET Version: " + Environment.Version);
                Console.WriteLine("Processor Count: " + Environment.ProcessorCount);
                Console.WriteLine("System Directory: " + Environment.SystemDirectory);
                Console.WriteLine("64-bit OS: " + Environment.Is64BitOperatingSystem);
                Console.WriteLine("64-bit Process: " + Environment.Is64BitProcess);
                
                if (detailed)
                {
                    Console.WriteLine("\n=== Detailed Information ===\n");
                    
                    // Network information
                    Console.WriteLine("--- Network Adapters ---");
                    string hostName = Dns.GetHostName();
                    IPAddress[] addresses = Dns.GetHostAddresses(hostName);
                    foreach (var addr in addresses)
                    {
                        if (addr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                        {
                            Console.WriteLine("IP Address: " + addr);
                        }
                    }
                    
                    // Drive information
                    Console.WriteLine("\n--- Drives ---");
                    foreach (var drive in System.IO.DriveInfo.GetDrives())
                    {
                        if (drive.IsReady)
                        {
                            Console.WriteLine($"{drive.Name} ({drive.DriveType}): " +
                                            $"{drive.TotalSize / (1024*1024*1024)}GB total, " +
                                            $"{drive.AvailableFreeSpace / (1024*1024*1024)}GB free");
                        }
                    }
                    
                    // Environment variables
                    Console.WriteLine("\n--- Key Environment Variables ---");
                    Console.WriteLine("COMPUTERNAME: " + Environment.GetEnvironmentVariable("COMPUTERNAME"));
                    Console.WriteLine("USERNAME: " + Environment.GetEnvironmentVariable("USERNAME"));
                    Console.WriteLine("USERDOMAIN: " + Environment.GetEnvironmentVariable("USERDOMAIN"));
                    
                    // Display first few PATH entries (PATH can be very long)
                    string[] pathEntries = Environment.GetEnvironmentVariable("PATH")?.Split(';');
                    Console.WriteLine($"PATH (showing first 3 of {pathEntries?.Length ?? 0} entries):");
                    if (pathEntries != null) {
                        for (int i = 0; i < Math.Min(3, pathEntries.Length); i++) {
                            Console.WriteLine($"  {pathEntries[i]}");
                        }
                    }
                }
                
                Console.WriteLine("\n=== Module execution completed successfully ===");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
                Environment.Exit(1);
            }
        }
    }
}
