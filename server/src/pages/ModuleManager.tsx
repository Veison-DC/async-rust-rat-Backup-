import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  IconUpload,
  IconPlayerPlay,
  IconTrash,
  IconRefresh,
  IconFileCode,
  IconCodeCircle,
  IconBrandCSharp,
  IconTerminal2,
  IconCheck,
  IconX,
  IconClock,
  IconAlertCircle,
  IconShieldCheck,
  IconHash,
  IconFileInfo,
} from "@tabler/icons-react";

interface LoadedModule {
  id: string;
  name: string;
  type: string;
  size: number;
  hash?: string;
  description: string;
  entry_point?: string;
}

interface ExecutionResult {
  module_id: string;
  success: boolean;
  output: string;
  error: string;
  exit_code: number;
}

export const ModuleManager = () => {
  const { addr } = useParams();
  const [loadedModules, setLoadedModules] = useState<LoadedModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  
  // Upload dialog state
  const [moduleFile, setModuleFile] = useState<string>("");
  const [moduleId, setModuleId] = useState<string>("");
  const [moduleName, setModuleName] = useState<string>("");
  const [moduleType, setModuleType] = useState<string>("PE");
  const [moduleDescription, setModuleDescription] = useState<string>("");
  const [entryPoint, setEntryPoint] = useState<string>("");
  
  // Execute dialog state
  const [executeArgs, setExecuteArgs] = useState<string>("");
  const [executeTimeout, setExecuteTimeout] = useState<number>(60);

  useEffect(() => {
    // Listen for module execution results
    const unlisten = listen<any>("module-execution-result", (event) => {
      if (event.payload.addr === addr) {
        const result: ExecutionResult = {
          module_id: event.payload.module_id,
          success: event.payload.success,
          output: event.payload.output,
          error: event.payload.error,
          exit_code: event.payload.exit_code,
        };
        setExecutionHistory((prev) => [result, ...prev]);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addr]);

  const handleBrowseModule = async () => {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Module Files',
        extensions: ['dll', 'exe', 'bin']
      }]
    });
    
    if (selected && typeof selected === 'string') {
      setModuleFile(selected);
      // Auto-generate module ID from filename
      const filename = selected.split(/[\\/]/).pop() || '';
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      setModuleId(nameWithoutExt + '_' + Date.now());
      setModuleName(nameWithoutExt);
    }
  };

  const handleLoadModule = async () => {
    if (!moduleFile || !moduleId || !moduleName) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Read module file
      const moduleData = await invoke<number[]>('read_module_file', {
        filePath: moduleFile
      });

      // Load module
      await invoke('load_module', {
        addr,
        moduleId,
        moduleName,
        moduleType,
        moduleData,
        entryPoint: entryPoint || null,
        description: moduleDescription
      });

      // Add to loaded modules list
      setLoadedModules((prev) => [
        ...prev,
        {
          id: moduleId,
          name: moduleName,
          type: moduleType,
          size: moduleData.length,
          description: moduleDescription,
          entry_point: entryPoint || undefined,
        }
      ]);

      // Reset form
      setModuleFile("");
      setModuleId("");
      setModuleName("");
      setModuleDescription("");
      setEntryPoint("");
      setShowUploadDialog(false);
    } catch (error) {
      alert(`Failed to load module: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteModule = async () => {
    if (!selectedModule) return;

    setLoading(true);
    try {
      const args = executeArgs.split(' ').filter(a => a.trim());
      
      await invoke('execute_module', {
        addr,
        moduleId: selectedModule,
        args,
        timeout: executeTimeout
      });

      setShowExecuteDialog(false);
      setExecuteArgs("");
    } catch (error) {
      alert(`Failed to execute module: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnloadModule = async (moduleId: string) => {
    if (!confirm(`Unload module ${moduleId}?`)) return;

    setLoading(true);
    try {
      await invoke('unload_module', { addr, moduleId });
      setLoadedModules((prev) => prev.filter(m => m.id !== moduleId));
      if (selectedModule === moduleId) {
        setSelectedModule(null);
      }
    } catch (error) {
      alert(`Failed to unload module: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshModules = async () => {
    setLoading(true);
    try {
      await invoke('list_modules', { addr });
      // The response would need to be handled via event listener
      // For now, this is a placeholder
    } catch (error) {
      console.error('Failed to refresh modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModuleIcon = (type: string) => {
    switch (type) {
      case 'PE':
        return <IconFileCode className="text-blue-400" size={20} />;
      case 'DotNetAssembly':
        return <IconBrandCSharp className="text-purple-400" size={20} />;
      case 'Shellcode':
        return <IconTerminal2 className="text-green-400" size={20} />;
      default:
        return <IconCodeCircle className="text-gray-400" size={20} />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] text-white p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Module Manager</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshModules}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2"
            disabled={loading}
          >
            <IconRefresh size={18} />
            Refresh
          </button>
          <button
            onClick={() => setShowUploadDialog(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded flex items-center gap-2"
          >
            <IconUpload size={18} />
            Load Module
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* Loaded Modules List */}
        <div className="w-1/3 bg-[#252525] rounded-lg p-4 overflow-auto">
          <h3 className="text-lg font-semibold mb-3">Loaded Modules</h3>
          {loadedModules.length === 0 ? (
            <p className="text-gray-400 text-sm">No modules loaded</p>
          ) : (
            <div className="space-y-2">
              {loadedModules.map((module) => (
                <div
                  key={module.id}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    selectedModule === module.id
                      ? 'bg-blue-600'
                      : 'bg-[#1a1a1a] hover:bg-[#2a2a2a]'
                  }`}
                  onClick={() => setSelectedModule(module.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getModuleIcon(module.type)}
                      <div>
                        <p className="font-medium">{module.name}</p>
                        <p className="text-xs text-gray-400">{module.type}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnloadModule(module.id);
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatBytes(module.size)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Module Details & Actions */}
        <div className="flex-1 bg-[#252525] rounded-lg p-4 overflow-auto">
          {selectedModule ? (
            <>
              <h3 className="text-lg font-semibold mb-3">Module Details</h3>
              {(() => {
                const module = loadedModules.find(m => m.id === selectedModule);
                if (!module) return null;
                
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">ID</p>
                        <p className="font-mono text-sm">{module.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Type</p>
                        <p className="text-sm">{module.type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Size</p>
                        <p className="text-sm">{formatBytes(module.size)}</p>
                      </div>
                      {module.entry_point && (
                        <div>
                          <p className="text-sm text-gray-400">Entry Point</p>
                          <p className="text-sm font-mono">{module.entry_point}</p>
                        </div>
                      )}
                    </div>
                    {module.description && (
                      <div>
                        <p className="text-sm text-gray-400">Description</p>
                        <p className="text-sm">{module.description}</p>
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowExecuteDialog(true)}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center gap-2"
                      disabled={loading}
                    >
                      <IconPlayerPlay size={18} />
                      Execute Module
                    </button>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a module to view details
            </div>
          )}
        </div>

        {/* Execution History */}
        <div className="w-1/3 bg-[#252525] rounded-lg p-4 overflow-auto">
          <h3 className="text-lg font-semibold mb-3">Execution History</h3>
          {executionHistory.length === 0 ? (
            <p className="text-gray-400 text-sm">No execution history</p>
          ) : (
            <div className="space-y-2">
              {executionHistory.map((result, idx) => (
                <div key={idx} className="p-3 bg-[#1a1a1a] rounded">
                  <div className="flex items-center gap-2 mb-1">
                    {result.success ? (
                      <IconCheck className="text-green-400" size={16} />
                    ) : (
                      <IconX className="text-red-400" size={16} />
                    )}
                    <p className="text-sm font-medium">{result.module_id}</p>
                  </div>
                  {result.output && (
                    <p className="text-xs text-gray-300 mt-1 font-mono whitespace-pre-wrap">
                      {result.output.substring(0, 200)}
                      {result.output.length > 200 && '...'}
                    </p>
                  )}
                  {result.error && (
                    <p className="text-xs text-red-400 mt-1">{result.error}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Exit code: {result.exit_code}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Module Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252525] rounded-lg p-6 w-[500px] max-h-[90vh] overflow-auto">
            <h3 className="text-xl font-bold mb-4">Load New Module</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Module File *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={moduleFile}
                    readOnly
                    className="flex-1 px-3 py-2 bg-[#1a1a1a] rounded border border-gray-600"
                    placeholder="Select module file..."
                  />
                  <button
                    onClick={handleBrowseModule}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Module ID *</label>
                <input
                  type="text"
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] rounded border border-gray-600"
                  placeholder="unique_module_id"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Module Name *</label>
                <input
                  type="text"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] rounded border border-gray-600"
                  placeholder="My Module"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Module Type *</label>
                <select
                  value={moduleType}
                  onChange={(e) => setModuleType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] rounded border border-gray-600"
                >
                  <option value="PE">PE/DLL</option>
                  <option value="DotNetAssembly">.NET Assembly</option>
                  <option value="Shellcode">Shellcode</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Entry Point (Optional)</label>
                <input
                  type="text"
                  value={entryPoint}
                  onChange={(e) => setEntryPoint(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] rounded border border-gray-600"
                  placeholder="Main, Execute, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={moduleDescription}
                  onChange={(e) => setModuleDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] rounded border border-gray-600"
                  rows={3}
                  placeholder="Module description..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleLoadModule}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load Module'}
              </button>
              <button
                onClick={() => setShowUploadDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execute Module Dialog */}
      {showExecuteDialog && selectedModule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252525] rounded-lg p-6 w-[500px]">
            <h3 className="text-xl font-bold mb-4">Execute Module</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Module ID</p>
                <p className="font-mono">{selectedModule}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Arguments</label>
                <input
                  type="text"
                  value={executeArgs}
                  onChange={(e) => setExecuteArgs(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] rounded border border-gray-600"
                  placeholder="arg1 arg2 arg3"
                />
                <p className="text-xs text-gray-400 mt-1">Space-separated arguments</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Timeout (seconds)</label>
                <input
                  type="number"
                  value={executeTimeout}
                  onChange={(e) => setExecuteTimeout(parseInt(e.target.value) || 60)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] rounded border border-gray-600"
                  min="1"
                  max="300"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleExecuteModule}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                disabled={loading}
              >
                {loading ? 'Executing...' : 'Execute'}
              </button>
              <button
                onClick={() => setShowExecuteDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
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
