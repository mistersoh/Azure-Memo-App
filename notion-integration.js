const { Client } = require('@notionhq/client');

// Initialize notion client - this will be done when credentials are set
let notionClient = null;

/**
 * Initialize the Notion client with the provided API key
 * @param {string} notionApiKey - The Notion API key
 */
function initClient(notionApiKey) {
  if (!notionApiKey) {
    throw new Error('Notion API key is required');
  }
  
  notionClient = new Client({
    auth: notionApiKey,
  });
  
  return notionClient;
}

/**
 * Add an item to a Notion database
 * @param {string} databaseId - The ID of the Notion database
 * @param {object} item - The item to add with properties matching Notion schema
 */
async function addItemToDatabase(databaseId, item) {
  if (!notionClient) {
    throw new Error('Notion client not initialized. Call initClient first.');
  }

  if (!databaseId) {
    throw new Error('Database ID is required');
  }

  try {
    const response = await notionClient.pages.create({
      parent: {
        database_id: databaseId,
      },
      properties: item,
    });
    
    return {
      success: true,
      pageId: response.id,
      url: response.url
    };
  } catch (error) {
    console.error('Error adding item to Notion database:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get database schema to understand the property structure
 * @param {object} client - Notion client instance 
 * @param {string} databaseId - The ID of the Notion database
 */
async function getDatabaseSchema(client, databaseId) {
  if (!client) {
    throw new Error('Notion client is required');
  }

  if (!databaseId || typeof databaseId !== 'string') {
    throw new Error('Database ID must be a string');
  }

  try {
    const response = await client.databases.retrieve({
      database_id: databaseId,
    });
    
    return response;
  } catch (error) {
    console.error('Error getting database schema:', error);
    throw new Error(`Failed to get database schema: ${error.message}`);
  }
}

/**
 * Create a Notion database item for an Azure DevOps work item
 * @param {object} workItem - Azure DevOps work item data
 * @param {object} schema - Notion database schema
 */
function createNotionItemFromWorkItem(workItem, schema) {
  // This is a placeholder - we'll need to map Azure DevOps fields to Notion fields
  // based on the actual schema of your Notion database
  
  // Default structure - modify according to your actual database schema
  const notionItem = {};
  
  // Map title - assuming there's a Title property in Notion
  if (schema.Title && schema.Title.type === 'title') {
    notionItem.Title = {
      title: [
        {
          text: {
            content: workItem.title
          }
        }
      ]
    };
  }
  
  // Map description - assuming there's a Description property in Notion
  if (schema.Description && schema.Description.type === 'rich_text') {
    notionItem.Description = {
      rich_text: [
        {
          text: {
            content: workItem.description || ''
          }
        }
      ]
    };
  }
  
  // Map type (Task/Bug) - assuming there's a Type property in Notion
  if (schema.Type && schema.Type.type === 'select') {
    notionItem.Type = {
      select: {
        name: workItem.type
      }
    };
  }
  
  // Map status - assuming there's a Status property in Notion
  if (schema.Status && schema.Status.type === 'select') {
    notionItem.Status = {
      select: {
        name: 'To Do' // Default to "To Do" for new items
      }
    };
  }
  
  return notionItem;
}

/**
 * Get current user from Notion API
 * @param {Object} client - Notion client instance
 * @returns {Object|null} - User object or null if error
 */
async function getCurrentUser(client) {
  try {
    // Fetch all users - the current user will be included
    const users = await client.users.list();
    
    console.log('All users in workspace:', users.results.map(u => ({
      id: u.id,
      name: u.name,
      type: u.type,
      avatar: u.avatar_url
    })));
    
    // Find the user marked as "bot"
    const botUser = users.results.find(user => user.type === "bot");
    
    if (botUser) {
      console.log('Found bot user:', botUser);
      return botUser;
    }
    
    // If no bot user, try to find any user we might use
    const anyUser = users.results[0];
    if (anyUser) {
      console.log('No bot user found, using first user:', anyUser);
      return anyUser;
    }
    
    console.log('No users found in the workspace');
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Add an item to a Notion database with client provided
 * @param {Object} client - Notion client instance
 * @param {string} databaseId - Notion database ID
 * @param {Object} item - Work item data
 * @returns {Object} - Created Notion page
 */
async function addItemToNotion(client, databaseId, item) {
  try {
    console.log('Creating Notion item with URL:', item.url);
    
    // Try to get the current user (the integration)
    const currentUser = await getCurrentUser(client);
    if (currentUser) {
      console.log('Current user found:', currentUser.name);
    }
    
    // Basic properties
    const properties = {
      // Title property
      'Task name': {
        title: [
          {
            text: {
              content: item.title
            }
          }
        ]
      }
    };
    
    // Add type if provided
    if (item.type) {
      properties['Type'] = {
        select: {
          name: item.type
        }
      };
    }
    
    // Add Azure ID if provided
    if (item.azureId) {
      properties['Azure ID'] = {
        number: parseInt(item.azureId, 10)
      };
    }
    
    // Add description if provided
    if (item.description) {
      properties['Description'] = {
        rich_text: [
          {
            text: {
              content: item.description
            }
          }
        ]
      };
    }
    
    // Add URL if provided - try the most common property name
    if (item.url) {
      console.log('Setting URL property:', item.url);
      properties['URL'] = {
        url: item.url
      };
    }
    
    // Create the page in Notion
    const response = await client.pages.create({
      parent: {
        database_id: databaseId
      },
      properties: properties,
      // Use the template if specified
      template: {
        name: "새 작업"
      },
      // Add description as page content if provided
      children: item.description ? [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: item.description
                }
              }
            ]
          }
        }
      ] : []
    });
    
    // Try assigning the user after page creation if initial assignment didn't work
    if (currentUser) {
      try {
        console.log('Trying to assign user via update method');
        const updateResponse = await client.pages.update({
          page_id: response.id,
          properties: {
            'Assignee': {
              people: [
                { id: currentUser.id }
              ]
            }
          }
        });
        console.log('Assignee update response:', updateResponse ? 'success' : 'no response');
      } catch (assignError) {
        console.error('Error updating assignee:', assignError);
      }
    }
    
    // If URL wasn't added with initial creation, try to update it with different property names
    if (item.url) {
      try {
        console.log('Trying alternative URL property names');
        // Try different property names one by one
        const urlPropertyNames = ['url', 'Link', 'Website', 'Azure URL'];
        
        for (const propertyName of urlPropertyNames) {
          try {
            await client.pages.update({
              page_id: response.id,
              properties: {
                [propertyName]: {
                  url: item.url
                }
              }
            });
            console.log(`Added URL with property name: ${propertyName}`);
            break; // Stop if one succeeds
          } catch (urlError) {
            console.log(`Failed to add URL with property name: ${propertyName}`);
          }
        }
      } catch (urlError) {
        console.error('Error adding URL with alternative property names:', urlError);
      }
    }
    
    // Parse title for FE/API tags and update
    try {
      const regex = /\[.*?\].*?\[(.*?)\]/;
      const match = item.title.match(regex);
      
      if (match && match[1]) {
        const feApiValue = match[1].trim();
        console.log('Found FE/API value:', feApiValue);
        
        await client.pages.update({
          page_id: response.id,
          properties: {
            'FE/API': {
              multi_select: [
                {
                  name: feApiValue
                }
              ]
            }
          }
        });
      }
    } catch (error) {
      console.error('Error updating FE/API:', error);
    }
    
    return response;
  } catch (error) {
    console.error('Error adding item to Notion:', error);
    throw new Error(`Failed to add item to Notion: ${error.message}`);
  }
}

// Export the functions
module.exports = {
  initClient,
  addItemToDatabase,
  getDatabaseSchema,
  addItemToNotion,
  getCurrentUser
}; 