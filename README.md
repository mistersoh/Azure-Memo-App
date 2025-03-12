# Azure DevOps Memo App

A simple desktop sticky note application that allows you to quickly create tasks and bugs in Azure DevOps without leaving your desktop.

## Features

- Create tasks and bugs directly in Azure DevOps
- Create Epics, Features, and User Stories on the fly
- Simple, sticky-note style interface
- Stays on top of other windows for easy access
- Secure storage of Azure DevOps credentials
- Works with any Azure DevOps organization
- Hierarchy selection for parent work items (Epics > Features > User Stories)
- Automatic self-assignment of created work items
- Area Path selection for organizing work by team or component
- Iteration/Sprint selection for planning work in specific time periods

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the application:
   ```
   npm start
   ```

3. Build executable:
   ```
   npm run build
   ```
   Or just run the included build.bat file (on Windows)

4. On first run, you'll need to configure the application with:
   - Your Azure DevOps organization name
   - Your project name
   - Your personal access token (PAT)
   - Your Azure DevOps username (for task assignment)

## Creating a Personal Access Token (PAT)

To use this application, you need to create a Personal Access Token in Azure DevOps:

1. Sign in to your Azure DevOps organization: https://dev.azure.com/{your-organization}
2. Click on your profile picture in the top right corner
3. Select "Personal Access Tokens"
4. Click "New Token"
5. Give your token a name (e.g., "Memo App")
6. Set the organization to your organization
7. Under "Scopes", select "Custom defined" and check "Work Items: Read & Write"
8. Set the expiration as needed
9. Click "Create"
10. Copy the generated token and paste it into the app's configuration

## Usage

1. Enter a title for your work item
2. Add a description (optional)
3. Select parent work items (optional):
   - Choose an Epic from the dropdown
   - After selecting an Epic, you can select a Feature under that Epic
   - After selecting a Feature, you can select a User Story under that Feature
   - You can create new Epics, Features, or User Stories by clicking the "+" button next to each dropdown
4. Select the work item type (Task or Bug)
5. Select an Area Path (optional) to categorize the work item
6. Select an Iteration/Sprint (optional) to plan when the work should be done
7. Click "Send"

The work item will be created in your Azure DevOps project, assigned to you, linked to the selected parent work item, placed in the specified Area Path, and scheduled for the selected Iteration. You'll see a confirmation message when it's complete.

## Creating New Parent Work Items

If you need to create a new Epic, Feature, or User Story to organize your work:

1. Click the "+" button next to the appropriate dropdown (Epic, Feature, or User Story)
2. Enter a title for the new work item
3. Optionally select an Area Path and Iteration
4. Click "Create"

The new work item will be created in Azure DevOps and automatically selected in the dropdown. You can then create tasks or bugs under it.

Features can only be created when an Epic is selected, and User Stories can only be created when a Feature is selected.

## Note on Work Item Hierarchy

The app supports the standard Azure DevOps hierarchy:
- Epics (top level)
- Features (under Epics)
- User Stories (under Features)
- Tasks or Bugs (under any of the above)

When you create a Task or Bug, it will be linked to the most specific parent item you selected (User Story > Feature > Epic).

## Area Paths

Area Paths in Azure DevOps help organize work items by team or component. By selecting an Area Path for your task or bug, you can ensure it appears in the right backlog or board for the appropriate team. If you don't select an Area Path, the work item will be created in the default area for your project.

## Iterations / Sprints

Iterations (also called Sprints) in Azure DevOps help organize work by time period. The app automatically lists all available iterations in your project and pre-selects the current sprint. By selecting an iteration for your task or bug, you can plan when the work should be done. Current sprints are clearly marked and iteration dates are displayed for easy reference.

## License

MIT 