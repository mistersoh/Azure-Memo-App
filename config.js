// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
  // Get UI elements
  const azureOrgInput = document.getElementById('azureOrg');
  const projectInput = document.getElementById('project');
  const patInput = document.getElementById('pat');
  const userNameInput = document.getElementById('userName');
  const saveConfigButton = document.getElementById('save-config');
  const messageDiv = document.getElementById('message');

  // Load existing configuration if available
  try {
    const config = await window.api.getConfig();
    if (config) {
      azureOrgInput.value = config.azureOrg || '';
      projectInput.value = config.project || '';
      userNameInput.value = config.userName || '';
      
      // PAT is not returned for security reasons
    }
  } catch (error) {
    showMessage('Error loading configuration', false);
  }

  // Save configuration when save button is clicked
  saveConfigButton.addEventListener('click', async () => {
    // Validate input
    if (!azureOrgInput.value.trim()) {
      showMessage('Please enter your Azure DevOps organization name', false);
      azureOrgInput.focus();
      return;
    }

    if (!projectInput.value.trim()) {
      showMessage('Please enter your Azure DevOps project name', false);
      projectInput.focus();
      return;
    }

    if (!patInput.value.trim()) {
      showMessage('Please enter your Personal Access Token (PAT)', false);
      patInput.focus();
      return;
    }

    if (!userNameInput.value.trim()) {
      showMessage('Please enter your username for task assignments', false);
      userNameInput.focus();
      return;
    }

    // Save configuration
    try {
      await window.api.saveConfig({
        azureOrg: azureOrgInput.value.trim(),
        project: projectInput.value.trim(),
        pat: patInput.value.trim(),
        userName: userNameInput.value.trim()
      });

      // Show success message
      showMessage('Configuration saved successfully', true);
      
      // Close window after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (error) {
      showMessage('Error saving configuration: ' + error.message, false);
    }
  });

  // Function to show message
  function showMessage(text, isSuccess) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + (isSuccess ? 'success' : 'error');
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }
}); 