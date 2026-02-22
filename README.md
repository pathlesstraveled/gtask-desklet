# Google Tasks Desklet

A Cinnamon desklet that displays your Google Tasks directly on your desktop.

## Requirements

- Linux Mint 20 or newer (or any distro running Cinnamon 4.0+)
- Cinnamon 4.0, 4.2, 4.4, 4.6, 4.8, 5.0, 5.2, 5.4, 5.6, 5.8, or 6.0
- Python 3.6 or newer (pre-installed on Linux Mint)
- A Google account with Google Tasks

> **Other distros:** The desklet will work on any Linux distribution running the Cinnamon desktop environment (e.g., Ubuntu with Cinnamon, Fedora Cinnamon Spin, Arch with Cinnamon). Linux Mint is the recommended environment.

## Installation

### Linux Mint / Ubuntu (Manual)

```bash
git clone https://github.com/pathlesstraveled/gtask-desklet.git
cd gtask-desklet
chmod +x install.sh
./install.sh
```

### From Cinnamon Spices

1. Open **System Settings → Desklets**
2. Search for **Google Tasks**
3. Click **Install**

## First Run

1. Right-click your desktop and select **Add Desklets**
2. Find **Google Tasks** and click **Add to Desktop**
3. Click **Sign in with Google** on the desklet
4. Your browser will open the Google OAuth screen — allow access to Google Tasks
5. You can close the browser tab and return to your desktop

Your credentials are stored locally in `~/.config/google-tasks-desklet/token.json` and are never sent anywhere other than Google's servers.

## Features

- **Multiple task lists** — tab bar to switch between all your Google Task lists
- **Subtasks** — nested under their parent tasks
- **Due dates** — color-coded: overdue in red, due today highlighted, upcoming shown
- **Task notes** — displayed beneath task titles
- **Toggle completion** — click the checkbox to mark tasks done or undone
- **Auto-refresh** — configurable interval (default: every 5 minutes)
- **Show/hide completed tasks** — toggle in desklet settings
- **Transparent glass theme** — dark blurred background with a clean accent UI

## Settings

Right-click the desklet and select **Configure** to adjust:

| Setting | Default | Description |
| --- | --- | --- |
| Show completed tasks | Off | Show done tasks with strikethrough |
| Auto-refresh interval | 5 min | How often to sync with Google |

## Troubleshooting

**Desklet not appearing in the list after install**

- Re-run `./install.sh`
- In Cinnamon System Settings → Desklets, click the refresh icon

**Tasks not loading / "Failed to fetch tasks"**

- Check your internet connection
- Click the ↻ button to manually refresh
- Sign out and sign back in

**Authentication window does not open**

- Make sure port `8765` is not in use by another application
- Try running `python3 google_tasks_api.py auth` from the install directory to see the error

## Sign Out

Click the **Logout** button in the desklet header. Your stored token is deleted. You can sign back in at any time.

## Issues

Open an issue at [github.com/pathlesstraveled/gtask-desklet/issues](https://github.com/pathlesstraveled/gtask-desklet/issues) with a description of the problem.

## Privacy

None of your task data is collected, stored, or shared with the developer or any third party. Tasks are fetched directly from Google's API to your machine. OAuth tokens are stored only in `~/.config/google-tasks-desklet/token.json`.

## License

GNU General Public License v3
