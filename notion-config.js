// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
  // Get UI elements
  const apiKeyInput = document.getElementById('apiKey');
  const databaseIdInput = document.getElementById('databaseId');
  const saveConfigButton = document.getElementById('save-config');
  const messageDiv = document.getElementById('message');

  // Load existing configuration if available
  try {
    const config = await window.api.getNotionConfig();
    if (config) {
      apiKeyInput.value = config.apiKey || '';
      databaseIdInput.value = config.databaseId || '';
    }
  } catch (error) {
    showMessage('Error loading configuration', false);
  }

  // Save configuration when save button is clicked
  saveConfigButton.addEventListener('click', async () => {
    // Validate input
    if (!apiKeyInput.value.trim()) {
      showMessage('Please enter your Notion API key', false);
      apiKeyInput.focus();
      return;
    }

    if (!databaseIdInput.value.trim()) {
      showMessage('Please enter your Notion database ID', false);
      databaseIdInput.focus();
      return;
    }

    // Save configuration
    try {
      saveConfigButton.disabled = true;
      saveConfigButton.textContent = 'Testing connection...';
      
      const result = await window.api.saveNotionConfig({
        apiKey: apiKeyInput.value.trim(),
        databaseId: databaseIdInput.value.trim()
      });

      if (result.success) {
        // Show success message
        showMessage('Notion configuration saved successfully', true);
        
        // Close window after a short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        showMessage(`Error: ${result.message}`, false);
        saveConfigButton.disabled = false;
        saveConfigButton.textContent = 'Save Configuration';
      }
    } catch (error) {
      showMessage('Error saving configuration: ' + error.message, false);
      saveConfigButton.disabled = false;
      saveConfigButton.textContent = 'Save Configuration';
    }
  });

  // Function to show message
  function showMessage(text, isSuccess) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + (isSuccess ? 'success' : 'error');
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds if it's a success
    if (isSuccess) {
      setTimeout(() => {
        messageDiv.style.display = 'none';
      }, 5000);
    }
  }
}); 