const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const Store = require('electron-store');
const notionIntegration = require('./notion-integration');

// Create a store for saving configuration
const store = new Store();

let mainWindow;
let notionConfigWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 400,
    height: 750,
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
    
    // Generate the URL to view the work item
    const workItemUrl = `https://dev.azure.com/${azureOrg}/${project}/_workitems/edit/${response.data.id}`;
    
    console.log('Created work item with URL:', workItemUrl);
    
    return { 
      success: true, 
      message: `${data.type} created successfully!`,
      id: response.data.id,
      url: workItemUrl,
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

// Show Azure DevOps configuration dialog
ipcMain.handle('show-config-dialog', async () => {
  // Create the config window
  const configWindow = new BrowserWindow({
    width: 400,
    height: 550,
    resizable: false,
    parent: mainWindow,
    modal: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });
  
  // Load the config.html file
  configWindow.loadFile('config.html');
  
  // Disable menu bar for cleaner interface
  configWindow.setMenuBarVisibility(false);
  
  // Show the window
  configWindow.show();
});

// Show Notion configuration dialog
ipcMain.handle('show-notion-config-dialog', async () => {
  // Create the config window
  notionConfigWindow = new BrowserWindow({
    width: 450,
    height: 600,
    resizable: false,
    parent: mainWindow,
    modal: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });
  
  // Load the notion-config.html file
  notionConfigWindow.loadFile('notion-config.html');
  
  // Disable menu bar for cleaner interface
  notionConfigWindow.setMenuBarVisibility(false);
  
  // Show the window
  notionConfigWindow.show();
});

// Check if Notion configuration exists
ipcMain.handle('check-notion-config', async () => {
  const config = {
    apiKey: store.get('notionApiKey'),
    databaseId: store.get('notionDatabaseId')
  };
  
  return config.apiKey && config.databaseId;
});

// Get Notion configuration
ipcMain.handle('get-notion-config', async () => {
  return {
    apiKey: store.get('notionApiKey'),
    databaseId: store.get('notionDatabaseId')
  };
});

// Save Notion configuration
ipcMain.handle('save-notion-config', async (event, config) => {
  try {
    // Initialize Notion client with the provided API key
    const client = notionIntegration.initClient(config.apiKey);
    
    // Just test the connection by retrieving the database - don't validate schema properties
    // This makes it more flexible for databases with different property names
    try {
      await notionIntegration.getDatabaseSchema(client, config.databaseId);
    } catch (err) {
      // If there's an error, it's likely due to permissions or invalid database ID
      return { 
        success: false, 
        message: `Error: Cannot access database. Make sure the database ID is correct and the integration has been given access to the database.`
      };
    }
    
    // If we get here, the connection was successful
    store.set('notionApiKey', config.apiKey);
    store.set('notionDatabaseId', config.databaseId);
    
    return { success: true, message: 'Notion configuration saved successfully' };
  } catch (error) {
    console.error('Error testing Notion connection:', error);
    return { 
      success: false, 
      message: `Error: ${error.message || 'Could not connect to Notion with provided credentials'}`
    };
  }
});

// Add work item to Notion
ipcMain.handle('add-to-notion', async (event, workItemData) => {
  try {
    // Get notion config
    const notionApiKey = store.get('notionApiKey');
    const notionDatabaseId = store.get('notionDatabaseId');
    const userName = store.get('userName'); // Get Azure user name for Assignee
    
    if (!notionApiKey || !notionDatabaseId) {
      return { success: false, message: 'Notion configuration is incomplete' };
    }
    
    // Ensure we have a valid URL from Azure DevOps
    if (!workItemData.url) {
      console.warn('No URL provided from Azure DevOps');
    } else {
      console.log('Received URL from Azure DevOps:', workItemData.url);
    }
    
    // Log the work item data for debugging
    console.log('Adding to Notion with data:', {
      title: workItemData.title,
      type: workItemData.type,
      azureId: workItemData.id,
      url: workItemData.url,
      assignee: userName
    });
    
    // Initialize Notion client
    const client = notionIntegration.initClient(notionApiKey);
    
    // Add the work item to Notion
    const result = await notionIntegration.addItemToNotion(
      client, 
      notionDatabaseId, 
      {
        title: workItemData.title,
        type: workItemData.type,
        description: workItemData.content,
        azureId: workItemData.id,
        url: workItemData.url,
        assignee: userName // Pass the Azure username as the Assignee
      }
    );
    
    return { success: true, notionPage: result };
  } catch (error) {
    console.error('Error adding to Notion:', error);
    return { 
      success: false, 
      message: `Error: ${error.message || 'Failed to add item to Notion'}`
    };
  }
}); 