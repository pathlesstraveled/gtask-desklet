# Google Tasks Desklet

Display your Google Tasks directly on your Cinnamon desktop.

## Requirements

- Cinnamon 4.0 or newer
- Linux Mint 20+ (recommended), or any Linux distro running Cinnamon
- Python 3.6 or newer (pre-installed on Linux Mint)
- A Google account with Google Tasks

## Installation

### Via Cinnamon Spices

1. Open **System Settings → Desklets**
2. Search for **Google Tasks**
3. Click **Install**

### Manual

```bash
git clone https://github.com/pathlesstraveled/gtask-desklet.git
cd gtask-desklet
chmod +x install.sh
./install.sh
```

## First Run

1. Right-click your desktop → **Add Desklets**
2. Find **Google Tasks** → **Add to Desktop**
3. Click **Sign in with Google** on the desklet
4. Complete the Google OAuth flow in your browser
5. Return to your desktop — your tasks will load automatically

## Features

- Switch between multiple Google Task lists with a tab bar
- Subtasks nested under their parents
- Color-coded due dates (overdue, today, upcoming)
- Task notes shown beneath titles
- Click a checkbox to toggle task completion
- Auto-refresh on a configurable interval
- Show or hide completed tasks from settings

## FAQ

**How do I manually refresh?**

Click the ↻ button in the desklet header.

**Tasks are not loading**

Check your internet connection, then click ↻ to retry. If the issue persists, sign out and sign back in.

**How do I sign out?**

Click the **Logout** button in the desklet header. You can sign back in at any time.

**How do I report a bug?**

Open an issue at [github.com/pathlesstraveled/gtask-desklet/issues](https://github.com/pathlesstraveled/gtask-desklet/issues).

## Privacy

None of your data is collected, stored, or shared with the developer or any third party. OAuth tokens are stored only in `~/.config/google-tasks-desklet/token.json` on your machine.
