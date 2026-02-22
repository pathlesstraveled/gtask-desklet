# Google Tasks Desklet

Display your Google Tasks natively on your Linux Mint Cinnamon desktop. Sign in with your Google account to see all your task lists and tasks with a beautiful transparent theme.

## Requirements

- Cinnamon 4.0 or later
- Python 3 (pre-installed on Linux Mint)
- Internet connection for Google Tasks API
- A Google account with Google Tasks

## Installation

This desklet can be installed directly from the Cinnamon Spices website or via **System Settings → Desklets**.

After adding the desklet to your desktop, click **"Sign in with Google"** to authenticate.

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

## Settings

Right-click the desklet and select **Settings** to configure:

| Setting | Default | Description |
| --- | --- | --- |
| Show completed tasks | Off | Shows done tasks with strikethrough |
| Auto-refresh interval | 5 min | How often to fetch from Google |

## Privacy

- All data stays local — tasks are fetched directly from Google's API to your machine
- OAuth tokens are stored only in `~/.config/google-tasks-desklet/token.json`
- No third-party servers involved

## Bug Reports

Please open a GitHub issue at [linuxmint/cinnamon-spices-desklets](https://github.com/linuxmint/cinnamon-spices-desklets/issues) if the desklet doesn't work as expected.
