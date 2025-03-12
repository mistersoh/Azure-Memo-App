const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const Store = require('electron-store');

// Create a store for saving configuration
const store = new Store();

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    resizable: false,
    alwaysOnTop: true,
    frame: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  // Load the index.html
  mainWindow.loadFile('index.html');
  
  // Disable menu bar for cleaner interface
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Check if configuration exists
ipcMain.handle('check-config', async () => {
  const config = {
    azureOrg: store.get('azureOrg'),
    project: store.get('project'),
    pat: store.get('pat'),
    userName: store.get('userName')
  };
  
  return config.azureOrg && config.project && config.pat;
});

// Get configuration
ipcMain.handle('get-config', async () => {
  return {
    azureOrg: store.get('azureOrg'),
    project: store.get('project'),
    userName: store.get('userName')
  };
});

// Save configuration
ipcMain.handle('save-config', async (event, config) => {
  store.set('azureOrg', config.azureOrg);
  store.set('project', config.project);
  store.set('pat', config.pat);
  store.set('userName', config.userName);
  return true;
});

// Fetch work items by type (Epic, Feature, User Story)
ipcMain.handle('fetch-work-items', async (event, { workItemType, parentId = null }) => {
  try {
    const azureOrg = store.get('azureOrg');
    const project = store.get('project');
    const pat = store.get('pat');
    
    if (!azureOrg || !project || !pat) {
      return { success: false, message: 'Configuration is incomplete' };
    }

    // Build the WIQL query based on work item type and parent
    let query = `SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.WorkItemType] = '${workItemType}'`;
    
    // Add parent relationship filter if a parent is specified
    if (parentId) {
      if (workItemType === 'Feature') {
        query += ` AND [System.Parent] = ${parentId}`;
      } else if (workItemType === 'User Story') {
        query += ` AND [System.Parent] = ${parentId}`;
      }
    }

    query += ' ORDER BY [System.Title] ASC';

    // Execute the WIQL query
    const response = await axios.post(
      `https://dev.azure.com/${azureOrg}/${project}/_apis/wit/wiql?api-version=6.0`,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
        }
      }
    );

    // If we have work items, get their details
    if (response.data.workItems && response.data.workItems.length > 0) {
      const workItemIds = response.data.workItems.map(item => item.id);
      
      // Get work item details in batches (if needed)
      const detailsResponse = await axios.post(
        `https://dev.azure.com/${azureOrg}/${project}/_apis/wit/workitemsbatch?api-version=6.0`,
        {
          ids: workItemIds,
          fields: ['System.Id', 'System.Title']
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
          }
        }
      );

      return {
        success: true,
        workItems: detailsResponse.data.value.map(item => ({
          id: item.id,
          title: item.fields['System.Title']
        }))
      };
    }

    return { success: true, workItems: [] };
  } catch (error) {
    console.error('Error fetching work items:', error);
    return {
      success: false,
      message: `Error: ${error.response?.data?.message || error.message}`
    };
  }
});

// Fetch Area Paths from Azure DevOps
ipcMain.handle('fetch-area-paths', async () => {
  try {
    const azureOrg = store.get('azureOrg');
    const project = store.get('project');
    const pat = store.get('pat');
    
    if (!azureOrg || !project || !pat) {
      return { success: false, message: 'Configuration is incomplete' };
    }

    // Azure DevOps API to get area paths
    const apiUrl = `https://dev.azure.com/${azureOrg}/${project}/_apis/wit/classificationnodes/Areas?$depth=10&api-version=6.0`;
    
    const response = await axios.get(
      apiUrl,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
        }
      }
    );
    
    // Process the area paths into a flat structure
    const areaPaths = [];
    
    function processAreaPath(node, path = '') {
      // If this is the root node (project), just use its name as the path
      // Otherwise, build the path including the project name
      const currentPath = path ? `${path}\\${node.name}` : node.name;
      
      // Add all paths including the root
      areaPaths.push({
        id: node.id,
        path: currentPath
      });
      
      // Process child nodes
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => processAreaPath(child, currentPath));
      }
    }
    
    // Start processing from the root node
    if (response.data) {
      processAreaPath(response.data);
    }
    
    return {
      success: true,
      areaPaths: areaPaths
    };
  } catch (error) {
    console.error('Error fetching area paths:', error);
    return {
      success: false,
      message: `Error: ${error.response?.data?.message || error.message}`
    };
  }
});

// Fetch Iterations from Azure DevOps
ipcMain.handle('fetch-iterations', async () => {
  try {
    const azureOrg = store.get('azureOrg');
    const project = store.get('project');
    const pat = store.get('pat');
    
    if (!azureOrg || !project || !pat) {
      return { success: false, message: 'Configuration is incomplete' };
    }

    // Azure DevOps API to get iterations
    const apiUrl = `https://dev.azure.com/${azureOrg}/${project}/_apis/work/teamsettings/iterations?api-version=6.0`;
    
    const response = await axios.get(
      apiUrl,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
        }
      }
    );
    
    // Process the iterations into a simpler structure
    const iterations = [];
    
    if (response.data && response.data.value) {
      response.data.value.forEach(iteration => {
        // Use the path directly - it already includes the project name
        iterations.push({
          id: iteration.id,
          name: iteration.name,
          path: iteration.path,
          startDate: iteration.attributes.startDate,
          finishDate: iteration.attributes.finishDate,
          timeFrame: iteration.attributes.timeFrame
        });
      });
    }
    
    return {
      success: true,
      iterations: iterations
    };
  } catch (error) {
    console.error('Error fetching iterations:', error);
    return {
      success: false,
      message: `Error: ${error.response?.data?.message || error.message}`
    };
  }
});

// Generic function to create any type of work item
ipcMain.handle('create-work-item', async (event, data) => {
  try {
    const azureOrg = store.get('azureOrg');
    const project = store.get('project');
    const pat = store.get('pat');
    const userName = store.get('userName');
    
    if (!azureOrg || !project || !pat) {
      return { success: false, message: 'Configuration is incomplete' };
    }

    const apiUrl = `https://dev.azure.com/${azureOrg}/${project}/_apis/wit/workitems/$${data.type}?api-version=6.0`;
    
    // Build the patch operations
    const patchOperations = [
      { op: "add", path: "/fields/System.Title", value: data.title }
    ];

    // Add description if provided
    if (data.description) {
      patchOperations.push({ op: "add", path: "/fields/System.Description", value: data.description });
    }

    // Add assignment if username is available and assignToSelf is true
    if (userName && data.assignToSelf) {
      patchOperations.push({ op: "add", path: "/fields/System.AssignedTo", value: userName });
    }

    // Add area path if provided
    if (data.areaPath) {
      // Use the area path as-is without prepending the project name
      // The Azure DevOps API will handle the project context automatically
      patchOperations.push({ op: "add", path: "/fields/System.AreaPath", value: data.areaPath });
    }

    // Add iteration path if provided
    if (data.iterationPath) {
      // Use the iteration path as-is without prepending the project name
      // The Azure DevOps API will handle the project context automatically
      patchOperations.push({ op: "add", path: "/fields/System.IterationPath", value: data.iterationPath });
    }

    // Add parent relation if parent is provided
    if (data.parentId) {
      patchOperations.push({
        op: "add",
        path: "/relations/-",
        value: {
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: `https://dev.azure.com/${azureOrg}/${project}/_apis/wit/workItems/${data.parentId}`
        }
      });
    }

    const response = await axios.patch(
      apiUrl,
      patchOperations,
      {
        headers: {
          'Content-Type': 'application/json-patch+json',
          'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
        }
      }
    );
    
    return { 
      success: true, 
      message: `${data.type} created successfully!`,
      id: response.data.id,
      title: data.title
    };
  } catch (error) {
    console.error('Error creating work item:', error);
    return { 
      success: false, 
      message: `Error: ${error.response?.data?.message || error.message}` 
    };
  }
});

// Keep existing send-work-item for backward compatibility, but just forward to create-work-item
ipcMain.handle('send-work-item', async (event, data) => {
  // Convert the old format to the new format
  const newData = {
    ...data,
    assignToSelf: true // Always assign tasks/bugs to self for backward compatibility
  };
  
  return await ipcMain.handle('create-work-item', event, newData);
});

// Show configuration dialog
ipcMain.handle('show-config-dialog', async () => {
  return new Promise((resolve) => {
    const configWindow = new BrowserWindow({
      width: 400,
      height: 450,
      parent: mainWindow,
      modal: true,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    });

    configWindow.loadFile('config.html');
    configWindow.setMenuBarVisibility(false);

    configWindow.on('closed', () => {
      resolve(true);
    });
  });
}); 