// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
  // Get UI elements
  const configRequiredDiv = document.getElementById('config-required');
  const contentAreaDiv = document.getElementById('content-area');
  const configureBtn = document.getElementById('configure-btn');
  const configBtn = document.getElementById('config-btn');
  const sendBtn = document.getElementById('send-btn');
  const titleInput = document.getElementById('title');
  const contentTextarea = document.getElementById('content');
  const typeSelect = document.getElementById('type');
  const areaPathSelect = document.getElementById('area-path');
  const iterationSelect = document.getElementById('iteration');
  const orgProjectSpan = document.getElementById('org-project');
  const statusDiv = document.getElementById('status');
  
  // Parent work item selectors
  const epicSelect = document.getElementById('epic-select');
  const featureSelect = document.getElementById('feature-select');
  const userStorySelect = document.getElementById('user-story-select');
  
  // Add buttons for creating new items
  const addEpicBtn = document.getElementById('add-epic-btn');
  const addFeatureBtn = document.getElementById('add-feature-btn');
  const addUserStoryBtn = document.getElementById('add-user-story-btn');
  
  // Modal elements
  const createWorkItemModal = document.getElementById('create-work-item-modal');
  const modalTitle = document.getElementById('modal-title');
  const newWorkItemTitleInput = document.getElementById('new-work-item-title');
  const newWorkItemAreaSelect = document.getElementById('new-work-item-area');
  const newWorkItemIterationSelect = document.getElementById('new-work-item-iteration');
  const cancelCreateBtn = document.getElementById('cancel-create-btn');
  const confirmCreateBtn = document.getElementById('confirm-create-btn');

  // Variables to track selected work items
  let selectedEpicId = '';
  let selectedFeatureId = '';
  let selectedUserStoryId = '';
  let selectedAreaPath = '';
  let selectedIteration = '';
  
  // Variables for the create work item modal
  let currentWorkItemType = '';
  let currentParentId = null;

  // Custom validation function to replace alert
  function showValidationError(message, inputField) {
    // Show the error message in the status bar
    statusDiv.textContent = `Error: ${message}`;
    statusDiv.style.color = '#d83b01';
    
    // Make sure the input field is enabled
    inputField.disabled = false;
    
    // Force the browser to rerender the input field
    inputField.style.display = 'none';
    setTimeout(() => {
      inputField.style.display = 'block';
      inputField.focus();
      
      // Reset status bar after 3 seconds
      setTimeout(() => {
        statusDiv.textContent = `Ready for ${orgProjectSpan.textContent}`;
        statusDiv.style.color = '';
      }, 3000);
    }, 10);
  }

  // Check if configuration exists
  const isConfigured = await window.api.checkConfig();
  if (isConfigured) {
    // Get organization and project for display
    const config = await window.api.getConfig();
    orgProjectSpan.textContent = `${config.azureOrg}/${config.project}`;
    
    // Show content area
    configRequiredDiv.style.display = 'none';
    contentAreaDiv.style.display = 'block';
    
    // Load area paths, iterations, and epics
    await Promise.all([
      loadAreaPaths(),
      loadIterations(),
      loadEpics()
    ]);
  } else {
    // Show configuration required
    configRequiredDiv.style.display = 'block';
    contentAreaDiv.style.display = 'none';
  }

  // Event listeners for add work item buttons
  addEpicBtn.addEventListener('click', () => showCreateWorkItemModal('Epic'));
  addFeatureBtn.addEventListener('click', () => showCreateWorkItemModal('Feature', selectedEpicId));
  addUserStoryBtn.addEventListener('click', () => showCreateWorkItemModal('User Story', selectedFeatureId));
  
  // Event listeners for modal buttons
  cancelCreateBtn.addEventListener('click', hideCreateWorkItemModal);
  confirmCreateBtn.addEventListener('click', createNewWorkItem);
  
  // Event listener for area path selection
  areaPathSelect.addEventListener('change', () => {
    selectedAreaPath = areaPathSelect.value;
  });

  // Event listener for iteration selection
  iterationSelect.addEventListener('change', () => {
    selectedIteration = iterationSelect.value;
  });

  // Event listeners for parent work item selection
  epicSelect.addEventListener('change', async () => {
    selectedEpicId = epicSelect.value;
    
    // Reset downstream selectors
    resetSelector(featureSelect, '-- Select Feature --');
    resetSelector(userStorySelect, '-- Select User Story --');
    featureSelect.disabled = true;
    userStorySelect.disabled = true;
    addFeatureBtn.disabled = true;
    addUserStoryBtn.disabled = true;
    
    selectedFeatureId = '';
    selectedUserStoryId = '';
    
    if (selectedEpicId) {
      await loadFeatures(selectedEpicId);
      addFeatureBtn.disabled = false;
    }
  });
  
  featureSelect.addEventListener('change', async () => {
    selectedFeatureId = featureSelect.value;
    
    // Reset user story selector
    resetSelector(userStorySelect, '-- Select User Story --');
    userStorySelect.disabled = true;
    addUserStoryBtn.disabled = true;
    
    selectedUserStoryId = '';
    
    if (selectedFeatureId) {
      await loadUserStories(selectedFeatureId);
      addUserStoryBtn.disabled = false;
    }
  });
  
  userStorySelect.addEventListener('change', () => {
    selectedUserStoryId = userStorySelect.value;
  });

  // Open configuration dialog when 'Configure' button is clicked
  configureBtn.addEventListener('click', openConfigDialog);
  configBtn.addEventListener('click', openConfigDialog);

  // Send button click event
  sendBtn.addEventListener('click', async () => {
    // Validate input
    if (!titleInput.value.trim()) {
      showValidationError('Please enter a title for the work item', titleInput);
      return;
    }

    // Update status
    statusDiv.textContent = 'Sending...';
    statusDiv.style.color = '';
    sendBtn.disabled = true;

    try {
      // Determine parent ID (use the most specific one selected)
      const parentId = selectedUserStoryId || selectedFeatureId || selectedEpicId || null;

      // Send work item to Azure DevOps
      const result = await window.api.createWorkItem({
        title: titleInput.value.trim(),
        description: contentTextarea.value.trim(),
        type: typeSelect.value,
        parentId: parentId,
        areaPath: selectedAreaPath,
        iterationPath: selectedIteration,
        assignToSelf: true // Always assign tasks/bugs to self
      });

      if (result.success) {
        // Show success message
        statusDiv.textContent = result.message;
        statusDiv.style.color = '#107c10';
        
        // Clear form
        titleInput.value = '';
        contentTextarea.value = '';
        
        // Reset after 3 seconds
        setTimeout(() => {
          window.api.getConfig().then(config => {
            statusDiv.textContent = `Ready for ${config.azureOrg}/${config.project}`;
            statusDiv.style.color = '';
          });
        }, 3000);
      } else {
        // Show error message
        statusDiv.textContent = result.message;
        statusDiv.style.color = '#d83b01';
      }
    } catch (error) {
      // Show error message
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.style.color = '#d83b01';
    } finally {
      // Enable send button
      sendBtn.disabled = false;
    }
  });
  
  // Function to show the create work item modal
  function showCreateWorkItemModal(workItemType, parentId = null) {
    currentWorkItemType = workItemType;
    currentParentId = parentId;
    
    // Update the modal title
    modalTitle.textContent = `Create New ${workItemType}`;
    
    // Clear the title input
    newWorkItemTitleInput.value = '';
    
    // Copy the area path and iteration options to the modal
    copySelectOptions(areaPathSelect, newWorkItemAreaSelect);
    copySelectOptions(iterationSelect, newWorkItemIterationSelect);
    
    // Show the modal
    createWorkItemModal.style.display = 'flex';
  }
  
  // Function to hide the create work item modal
  function hideCreateWorkItemModal() {
    createWorkItemModal.style.display = 'none';
  }
  
  // Function to create a new work item
  async function createNewWorkItem() {
    // Validate input
    if (!newWorkItemTitleInput.value.trim()) {
      showValidationError('Please enter a title for the work item', newWorkItemTitleInput);
      return;
    }
    
    // Show status
    statusDiv.textContent = `Creating ${currentWorkItemType}...`;
    statusDiv.style.color = '';
    confirmCreateBtn.disabled = true;
    
    try {
      // Create the work item
      const result = await window.api.createWorkItem({
        title: newWorkItemTitleInput.value.trim(),
        type: currentWorkItemType,
        parentId: currentParentId,
        areaPath: newWorkItemAreaSelect.value,
        iterationPath: newWorkItemIterationSelect.value,
        assignToSelf: false // Don't automatically assign parent items
      });
      
      if (result.success) {
        // Hide the modal
        hideCreateWorkItemModal();
        
        // Show success message
        statusDiv.textContent = result.message;
        statusDiv.style.color = '#107c10';
        
        // Refresh the appropriate dropdown
        if (currentWorkItemType === 'Epic') {
          await loadEpics();
          
          // Select the newly created epic
          epicSelect.value = result.id;
          selectedEpicId = result.id;
          
          // Trigger the change event to load features
          await loadFeatures(result.id);
          addFeatureBtn.disabled = false;
        } 
        else if (currentWorkItemType === 'Feature') {
          await loadFeatures(selectedEpicId);
          
          // Select the newly created feature
          featureSelect.value = result.id;
          selectedFeatureId = result.id;
          
          // Trigger the change event to load user stories
          await loadUserStories(result.id);
          addUserStoryBtn.disabled = false;
        } 
        else if (currentWorkItemType === 'User Story') {
          await loadUserStories(selectedFeatureId);
          
          // Select the newly created user story
          userStorySelect.value = result.id;
          selectedUserStoryId = result.id;
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          statusDiv.textContent = `Ready for ${orgProjectSpan.textContent}`;
          statusDiv.style.color = '';
        }, 3000);
      } else {
        // Show error message
        statusDiv.textContent = result.message;
        statusDiv.style.color = '#d83b01';
        
        // Make sure input is focusable
        newWorkItemTitleInput.disabled = false;
        setTimeout(() => {
          newWorkItemTitleInput.focus();
        }, 10);
      }
    } catch (error) {
      // Show error message
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.style.color = '#d83b01';
      
      // Make sure input is focusable
      newWorkItemTitleInput.disabled = false;
      setTimeout(() => {
        newWorkItemTitleInput.focus();
      }, 10);
    } finally {
      // Enable create button
      confirmCreateBtn.disabled = false;
    }
  }
  
  // Helper function to copy options from one select to another
  function copySelectOptions(sourceSelect, targetSelect) {
    // Clear the target select except the first option
    while (targetSelect.options.length > 1) {
      targetSelect.remove(1);
    }
    
    // Copy options from source to target
    for (let i = 1; i < sourceSelect.options.length; i++) {
      const option = document.createElement('option');
      option.value = sourceSelect.options[i].value;
      option.textContent = sourceSelect.options[i].textContent;
      targetSelect.appendChild(option);
    }
  }

  // Function to load iterations
  async function loadIterations() {
    try {
      statusDiv.textContent = 'Loading iterations...';
      
      // Fetch iterations from Azure DevOps
      const result = await window.api.fetchIterations();
      
      if (result.success) {
        // Reset selector but keep the default option
        resetSelector(iterationSelect, '-- Default Iteration --');
        
        // Add iterations to dropdown, sorted by start date (most recent first)
        result.iterations
          .sort((a, b) => {
            // Sort by timeFrame first (Current > Future > Past)
            const timeFrameOrder = { Current: 0, Future: 1, Past: 2 };
            const timeFrameComp = timeFrameOrder[a.timeFrame] - timeFrameOrder[b.timeFrame];
            
            if (timeFrameComp !== 0) return timeFrameComp;
            
            // Then sort by date (newest first)
            if (a.startDate && b.startDate) {
              return new Date(b.startDate) - new Date(a.startDate);
            }
            return 0;
          })
          .forEach(iteration => {
            const option = document.createElement('option');
            option.value = iteration.path;
            
            // Format the option text to include dates for active sprints
            let optionText = iteration.name;
            if (iteration.startDate && iteration.finishDate) {
              const startDate = new Date(iteration.startDate).toLocaleDateString();
              const endDate = new Date(iteration.finishDate).toLocaleDateString();
              optionText += ` (${startDate} - ${endDate})`;
            }
            
            // Add indicator for current sprint
            if (iteration.timeFrame === 'Current') {
              optionText += ' [Current]';
            }
            
            option.textContent = optionText;
            iterationSelect.appendChild(option);
          });
        
        // Find current sprint and select it by default
        const currentSprint = result.iterations.find(i => i.timeFrame === 'Current');
        if (currentSprint) {
          iterationSelect.value = currentSprint.path;
          selectedIteration = currentSprint.path;
        }
        
        statusDiv.textContent = `Ready for ${await getCurrentProjectName()}`;
      } else {
        statusDiv.textContent = result.message || 'Error loading iterations';
      }
    } catch (error) {
      console.error('Error loading iterations:', error);
      statusDiv.textContent = 'Error loading iterations';
    }
  }

  // Function to load area paths
  async function loadAreaPaths() {
    try {
      statusDiv.textContent = 'Loading area paths...';
      
      // Fetch area paths from Azure DevOps
      const result = await window.api.fetchAreaPaths();
      
      if (result.success) {
        // Reset selector but keep the default option
        resetSelector(areaPathSelect, '-- Default Area --');
        
        // Add area paths to dropdown, sorted alphabetically
        result.areaPaths
          .sort((a, b) => a.path.localeCompare(b.path))
          .forEach(areaPath => {
            const option = document.createElement('option');
            option.value = areaPath.path;
            option.textContent = areaPath.path;
            areaPathSelect.appendChild(option);
          });
        
        statusDiv.textContent = `Ready for ${await getCurrentProjectName()}`;
      } else {
        statusDiv.textContent = result.message || 'Error loading area paths';
      }
    } catch (error) {
      console.error('Error loading area paths:', error);
      statusDiv.textContent = 'Error loading area paths';
    }
  }

  // Function to load epics
  async function loadEpics() {
    try {
      statusDiv.textContent = 'Loading epics...';
      
      // Fetch epics from Azure DevOps
      const result = await window.api.fetchWorkItems({ workItemType: 'Epic' });
      
      if (result.success) {
        // Reset selector
        resetSelector(epicSelect, '-- Select Epic --');
        
        // Add epics to dropdown
        result.workItems.forEach(epic => {
          const option = document.createElement('option');
          option.value = epic.id;
          option.textContent = epic.title;
          epicSelect.appendChild(option);
        });
        
        // Enable selector
        epicSelect.disabled = false;
        
        statusDiv.textContent = `Ready for ${await getCurrentProjectName()}`;
      } else {
        statusDiv.textContent = result.message || 'Error loading epics';
      }
    } catch (error) {
      console.error('Error loading epics:', error);
      statusDiv.textContent = 'Error loading epics';
    }
  }

  // Function to load features under an epic
  async function loadFeatures(epicId) {
    try {
      statusDiv.textContent = 'Loading features...';
      
      // Fetch features from Azure DevOps
      const result = await window.api.fetchWorkItems({ 
        workItemType: 'Feature',
        parentId: epicId
      });
      
      if (result.success) {
        // Reset selector
        resetSelector(featureSelect, '-- Select Feature --');
        
        // Add features to dropdown
        result.workItems.forEach(feature => {
          const option = document.createElement('option');
          option.value = feature.id;
          option.textContent = feature.title;
          featureSelect.appendChild(option);
        });
        
        // Enable selector
        featureSelect.disabled = false;
        
        statusDiv.textContent = `Ready for ${await getCurrentProjectName()}`;
      } else {
        statusDiv.textContent = result.message || 'Error loading features';
      }
    } catch (error) {
      console.error('Error loading features:', error);
      statusDiv.textContent = 'Error loading features';
    }
  }

  // Function to load user stories under a feature
  async function loadUserStories(featureId) {
    try {
      statusDiv.textContent = 'Loading user stories...';
      
      // Fetch user stories from Azure DevOps
      const result = await window.api.fetchWorkItems({ 
        workItemType: 'User Story',
        parentId: featureId
      });
      
      if (result.success) {
        // Reset selector
        resetSelector(userStorySelect, '-- Select User Story --');
        
        // Add user stories to dropdown
        result.workItems.forEach(story => {
          const option = document.createElement('option');
          option.value = story.id;
          option.textContent = story.title;
          userStorySelect.appendChild(option);
        });
        
        // Enable selector
        userStorySelect.disabled = false;
        
        statusDiv.textContent = `Ready for ${await getCurrentProjectName()}`;
      } else {
        statusDiv.textContent = result.message || 'Error loading user stories';
      }
    } catch (error) {
      console.error('Error loading user stories:', error);
      statusDiv.textContent = 'Error loading user stories';
    }
  }

  // Helper function to reset a selector
  function resetSelector(selector, defaultText) {
    selector.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = defaultText;
    selector.appendChild(defaultOption);
  }

  // Helper function to get current project name
  async function getCurrentProjectName() {
    const config = await window.api.getConfig();
    return `${config.azureOrg}/${config.project}`;
  }

  // Function to open configuration dialog
  async function openConfigDialog() {
    await window.api.showConfigDialog();
    
    // Check configuration again
    const isConfigured = await window.api.checkConfig();
    if (isConfigured) {
      // Get organization and project for display
      const config = await window.api.getConfig();
      orgProjectSpan.textContent = `${config.azureOrg}/${config.project}`;
      
      // Show content area
      configRequiredDiv.style.display = 'none';
      contentAreaDiv.style.display = 'block';
      
      // Update status
      statusDiv.textContent = `Ready for ${config.azureOrg}/${config.project}`;
      
      // Reload area paths, iterations, and epics
      await Promise.all([
        loadAreaPaths(),
        loadIterations(),
        loadEpics()
      ]);
    } else {
      // Show configuration required
      configRequiredDiv.style.display = 'block';
      contentAreaDiv.style.display = 'none';
    }
  }
}); 