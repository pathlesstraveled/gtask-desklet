# Google Tasks Desklet

A native Linux Mint Cinnamon desklet that displays your Google Tasks directly on your desktop with a beautiful transparent glassmorphism theme.

## Features

- **Google OAuth2 login** — secure sign-in via browser, tokens stored locally
- **All task lists** — switch between multiple Google Task lists with a tab bar
- **Subtasks** — nested subtasks shown under their parents
- **Due dates** — color-coded (overdue in red, today highlighted, upcoming shown)
- **Task notes** — notes shown beneath task titles
- **Toggle completion** — click the checkbox to mark tasks done/undone
- **Auto-refresh** — configurable refresh interval (default: every 5 minutes)
- **Show/hide completed** — configurable in desklet settings
- **Transparent glass theme** — dark, blurred background with color-accented UI

## Requirements

- Linux Mint with Cinnamon desktop
- Python 3 (pre-installed on Linux Mint)
- Internet connection for Google Tasks API
- A Google account with Google Tasks

## Installation

1. Download or clone this repository.
2. Run the installer:

```bash
cd ~/AI/google\ tasks\ desklet
chmod +x install.sh
./install.sh
```

3. Right-click your Cinnamon desktop and select **Add Desklets**.
4. Find **Google Tasks** in the list and click **Add to Desktop**.
5. Click **"Sign in with Google"** on the desklet to authenticate.

---


## Desklet Settings

Right-click the desklet and select **Settings** to configure:

| Setting | Default | Description |
| --- | --- | --- |
| Show completed tasks | Off | Shows done tasks with strikethrough |
| Auto-refresh interval | 5 min | How often to fetch from Google |

## File Structure

```
google-tasks@desklet/               # Cinnamon Spices submission root
├── files/
│   └── google-tasks@desklet/       # Actual desklet files
│       ├── desklet.js              # Main Cinnamon desklet (JavaScript/GJS)
│       ├── google_tasks_api.py     # Python backend: OAuth2 + Google Tasks API
│       ├── stylesheet.css          # Transparent glass theme
│       ├── metadata.json           # Desklet metadata
│       ├── settings-schema.json    # Desklet settings definition
│       └── icons/                  # Desklet icons
├── info.json                       # Spices author info
└── README.md                       # Spices-facing README
```

## How It Works

1. **`desklet.js`** — runs in Cinnamon's JavaScript environment (GJS). Builds the UI using St (Shell Toolkit) widgets. Spawns the Python backend as a subprocess.
2. **`google_tasks_api.py`** — handles all Google API communication:
  - `auth` — starts a local HTTP server on port 8765, opens the browser for OAuth2, exchanges the code for tokens, and saves them
  - `fetch` — fetches all task lists and tasks, outputs JSON
  - `complete`/`uncomplete` — updates task status via the API
  - `logout` — deletes stored tokens
3. **Tokens** are stored in `~/.config/google-tasks-desklet/token.json`. The access token is auto-refreshed using the stored refresh token.

## Troubleshooting

**"Failed to fetch tasks"**
- Check your internet connection
- Click Refresh (↻) button to retry
- Try signing out and signing in again

**Desklet not appearing in the list**
- Run `./install.sh` again
- In Cinnamon System Settings > Desklets, click the refresh button

**Tasks not updating**
- The desklet auto-refreshes on the configured interval
- Click the ↻ button for an immediate refresh

## Logout

Click the **Logout** button in the desklet header to sign out. Your tokens are deleted from disk. You can sign in again at any time.

## Privacy

- All data stays local — tasks are fetched directly from Google's API to your machine
- OAuth tokens are stored only in `~/.config/google-tasks-desklet/token.json`
- No third-party servers involved
