const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Check if configuration exists
    checkConfig: () => ipcRenderer.invoke('check-config'),
    
    // Get configuration
    getConfig: () => ipcRenderer.invoke('get-config'),
    
    // Save configuration
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    
    // Show configuration dialog
    showConfigDialog: () => ipcRenderer.invoke('show-config-dialog'),
    
    // Send work item to Azure DevOps (legacy)
    sendWorkItem: (data) => ipcRenderer.invoke('send-work-item', data),
    
    // Create any type of work item
    createWorkItem: (data) => ipcRenderer.invoke('create-work-item', data),
    
    // Fetch work items by type and optional parent
    fetchWorkItems: (params) => ipcRenderer.invoke('fetch-work-items', params),
    
    // Fetch area paths
    fetchAreaPaths: () => ipcRenderer.invoke('fetch-area-paths'),
    
    // Fetch iterations
    fetchIterations: () => ipcRenderer.invoke('fetch-iterations')
  }
); 