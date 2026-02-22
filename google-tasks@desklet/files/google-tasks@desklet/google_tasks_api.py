#!/usr/bin/env python3
"""
Google Tasks API backend for the Cinnamon desklet.
Handles OAuth2 authentication and fetches tasks from Google Tasks API.

Usage:
  python3 google_tasks_api.py auth       - Start OAuth2 flow
  python3 google_tasks_api.py fetch      - Fetch all tasks (JSON output)
  python3 google_tasks_api.py status     - Check auth status
  python3 google_tasks_api.py logout     - Remove stored credentials
  python3 google_tasks_api.py complete <tasklist_id> <task_id>  - Mark task complete
  python3 google_tasks_api.py uncomplete <tasklist_id> <task_id> - Mark task incomplete
"""

import sys
import os
import json
import urllib.request
import urllib.parse
import urllib.error
import http.server
import threading
import webbrowser
import time
import socket

# --- Configuration ---
CONFIG_DIR = os.path.expanduser("~/.config/google-tasks-desklet")
CREDENTIALS_FILE = os.path.join(CONFIG_DIR, "credentials.json")
TOKEN_FILE = os.path.join(CONFIG_DIR, "token.json")
CLIENT_SECRETS_FILE = os.path.join(CONFIG_DIR, "client_secret.json")

OAUTH_SCOPE = "https://www.googleapis.com/auth/tasks"
REDIRECT_URI = "http://localhost:8765/oauth2callback"
TOKEN_URL = "https://oauth2.googleapis.com/token"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TASKS_API_BASE = "https://tasks.googleapis.com/tasks/v1"

# Developer: Replace these with your Google Cloud OAuth Desktop application credentials
# before distributing the desklet.
DEFAULT_CLIENT_ID = "REPLACE_WITH_YOUR_CLIENT_ID"
DEFAULT_CLIENT_SECRET = "REPLACE_WITH_YOUR_CLIENT_SECRET"

os.makedirs(CONFIG_DIR, exist_ok=True)


def load_client_secrets():
    """Load OAuth client secrets from file."""
    if os.path.exists(CLIENT_SECRETS_FILE):
        with open(CLIENT_SECRETS_FILE) as f:
            data = json.load(f)
        # Support both "installed" and "web" app types
        app = data.get("installed") or data.get("web") or {}
        return app.get("client_id", ""), app.get("client_secret", "")
    # Fall back to embedded credentials file
    if os.path.exists(CREDENTIALS_FILE):
        with open(CREDENTIALS_FILE) as f:
            data = json.load(f)
        return data.get("client_id", ""), data.get("client_secret", "")
    return DEFAULT_CLIENT_ID, DEFAULT_CLIENT_SECRET


def load_token():
    """Load stored OAuth token."""
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE) as f:
            return json.load(f)
    return None


def save_token(token_data):
    """Save OAuth token to disk."""
    with open(TOKEN_FILE, "w") as f:
        json.dump(token_data, f, indent=2)


def delete_token():
    """Remove stored token."""
    if os.path.exists(TOKEN_FILE):
        os.remove(TOKEN_FILE)


def refresh_access_token(token_data):
    """Refresh the access token using the refresh token."""
    client_id, client_secret = load_client_secrets()
    if not client_id:
        return None

    refresh_token = token_data.get("refresh_token")
    if not refresh_token:
        return None

    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()

    try:
        req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=10) as resp:
            new_token = json.loads(resp.read())
            # Preserve refresh token (not always returned on refresh)
            if "refresh_token" not in new_token:
                new_token["refresh_token"] = refresh_token
            new_token["obtained_at"] = time.time()
            save_token(new_token)
            return new_token
    except Exception as e:
        return None


def get_valid_token():
    """Get a valid access token, refreshing if necessary."""
    token_data = load_token()
    if not token_data:
        return None

    # Check if expired (with 60s buffer)
    obtained_at = token_data.get("obtained_at", 0)
    expires_in = token_data.get("expires_in", 3600)
    if time.time() > obtained_at + expires_in - 60:
        token_data = refresh_access_token(token_data)

    return token_data


def api_get(endpoint, token_data, params=None):
    """Make an authenticated GET request to the Tasks API."""
    url = TASKS_API_BASE + endpoint
    if params:
        url += "?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(url)
    req.add_header("Authorization", "Bearer " + token_data["access_token"])
    req.add_header("Accept", "application/json")

    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def api_patch(endpoint, token_data, body):
    """Make an authenticated PATCH request to the Tasks API."""
    url = TASKS_API_BASE + endpoint
    data = json.dumps(body).encode()

    req = urllib.request.Request(url, data=data, method="PATCH")
    req.add_header("Authorization", "Bearer " + token_data["access_token"])
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")

    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def api_post(endpoint, token_data, body):
    """Make an authenticated POST request to the Tasks API."""
    url = TASKS_API_BASE + endpoint
    data = json.dumps(body).encode()

    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", "Bearer " + token_data["access_token"])
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")

    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def create_task(tasklist_id, title):
    """Create a new task in the specified task list."""
    token_data = get_valid_token()
    if not token_data:
        return {"error": "not_authenticated"}

    try:
        body = {"title": title, "status": "needsAction"}
        result = api_post(
            f"/lists/{tasklist_id}/tasks",
            token_data,
            body
        )
        return {"status": "ok", "task": result}
    except Exception as e:
        return {"error": str(e)}


def fetch_all_tasks():
    """Fetch all task lists and their tasks from Google Tasks API."""
    token_data = get_valid_token()
    if not token_data:
        return {"error": "not_authenticated", "message": "Not authenticated. Please log in."}

    try:
        # Get all task lists
        tasklists_resp = api_get("/users/@me/lists", token_data)
        tasklists = tasklists_resp.get("items", [])

        result = {
            "status": "ok",
            "tasklists": []
        }

        for tl in tasklists:
            tl_id = tl["id"]
            tl_data = {
                "id": tl_id,
                "title": tl.get("title", "Untitled"),
                "tasks": []
            }

            # Fetch tasks for this list
            try:
                tasks_resp = api_get(
                    f"/lists/{tl_id}/tasks",
                    token_data,
                    params={
                        "showCompleted": "true",
                        "showHidden": "false",
                        "maxResults": "100"
                    }
                )
                raw_tasks = tasks_resp.get("items", [])

                # Build task tree (parent/subtask relationships)
                task_map = {}
                for task in raw_tasks:
                    task_map[task["id"]] = {
                        "id": task["id"],
                        "title": task.get("title", "(no title)"),
                        "status": task.get("status", "needsAction"),
                        "notes": task.get("notes", ""),
                        "due": task.get("due", ""),
                        "updated": task.get("updated", ""),
                        "parent": task.get("parent", ""),
                        "position": task.get("position", ""),
                        "subtasks": []
                    }

                # Nest subtasks under parents, collect top-level tasks
                top_level = []
                for task in raw_tasks:
                    tid = task["id"]
                    parent_id = task.get("parent", "")
                    if parent_id and parent_id in task_map:
                        task_map[parent_id]["subtasks"].append(task_map[tid])
                    else:
                        top_level.append(task_map[tid])

                tl_data["tasks"] = top_level

            except Exception as e:
                tl_data["tasks"] = []
                tl_data["error"] = str(e)

            result["tasklists"].append(tl_data)

        return result

    except urllib.error.HTTPError as e:
        if e.code == 401:
            # Try to refresh
            token_data_old = load_token()
            if token_data_old:
                refreshed = refresh_access_token(token_data_old)
                if refreshed:
                    return fetch_all_tasks()
            return {"error": "auth_expired", "message": "Authentication expired. Please log in again."}
        return {"error": "api_error", "message": f"API error: {e.code} {e.reason}"}
    except Exception as e:
        return {"error": "network_error", "message": f"Network error: {str(e)}"}


def complete_task(tasklist_id, task_id, completed=True):
    """Mark a task as complete or incomplete."""
    token_data = get_valid_token()
    if not token_data:
        return {"error": "not_authenticated"}

    try:
        status = "completed" if completed else "needsAction"
        result = api_patch(
            f"/lists/{tasklist_id}/tasks/{task_id}",
            token_data,
            {"status": status}
        )
        return {"status": "ok", "task": result}
    except Exception as e:
        return {"error": str(e)}


def check_status():
    """Check authentication status."""
    client_id, _ = load_client_secrets()
    if not client_id or client_id == "REPLACE_WITH_YOUR_CLIENT_ID":
        return {
            "status": "no_credentials",
            "message": "The desklet developer has not configured the Google API credentials."
        }

    token_data = load_token()
    if not token_data:
        return {"status": "not_authenticated", "message": "Not logged in."}

    # Try to get valid token
    valid = get_valid_token()
    if valid:
        return {"status": "authenticated", "message": "Logged in and token is valid."}
    else:
        return {"status": "token_expired", "message": "Token expired and could not be refreshed."}


# ---- OAuth2 Local Server ----

_auth_code = None
_auth_error = None
_server_done = threading.Event()


class OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global _auth_code, _auth_error
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            _auth_code = params["code"][0]
            html = self._success_page()
        elif "error" in params:
            _auth_error = params.get("error", ["unknown"])[0]
            html = self._error_page(_auth_error)
        else:
            html = self._error_page("Unknown callback")

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode())
        _server_done.set()

    def log_message(self, format, *args):
        pass  # Suppress server logs

    def _success_page(self):
        return """<!DOCTYPE html>
<html>
<head><title>Google Tasks Desklet - Auth Success</title>
<style>
  body { font-family: sans-serif; background: #1a1a2e; color: #eee;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { background: rgba(255,255,255,0.1); border-radius: 16px; padding: 40px;
         text-align: center; max-width: 400px; }
  h1 { color: #4fc3f7; } p { color: #aaa; }
</style></head>
<body><div class="box">
  <h1>&#10003; Success!</h1>
  <p>You've been authenticated with Google Tasks.</p>
  <p>You can close this window and return to your desktop.</p>
</div></body></html>"""

    def _error_page(self, error):
        return f"""<!DOCTYPE html>
<html>
<head><title>Auth Error</title>
<style>
  body {{ font-family: sans-serif; background: #1a1a2e; color: #eee;
          display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
  .box {{ background: rgba(255,0,0,0.1); border-radius: 16px; padding: 40px; text-align: center; }}
  h1 {{ color: #ef5350; }}
</style></head>
<body><div class="box">
  <h1>&#10007; Auth Error</h1>
  <p>{error}</p>
</div></body></html>"""


def start_oauth_flow():
    """Start the OAuth2 flow by opening a browser and waiting for callback."""
    global _auth_code, _auth_error, _server_done
    _auth_code = None
    _auth_error = None
    _server_done.clear()

    client_id, client_secret = load_client_secrets()
    if not client_id or client_id == "REPLACE_WITH_YOUR_CLIENT_ID":
        print(json.dumps({
            "error": "no_credentials",
            "message": "The desklet developer has not configured the Google API credentials."
        }))
        sys.exit(1)

    # Start local HTTP server for callback
    try:
        server = http.server.HTTPServer(("localhost", 8765), OAuthCallbackHandler)
    except OSError:
        print(json.dumps({"error": "port_in_use", "message": "Port 8765 is in use. Please close other applications using it."}))
        sys.exit(1)

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    # Build auth URL
    params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": OAUTH_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = AUTH_URL + "?" + urllib.parse.urlencode(params)

    print(json.dumps({"status": "opening_browser", "url": auth_url}))
    webbrowser.open(auth_url)

    # Wait for callback (timeout 120s)
    _server_done.wait(timeout=120)
    server.shutdown()

    if _auth_code:
        # Exchange code for token
        data = urllib.parse.urlencode({
            "code": _auth_code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        }).encode()

        try:
            req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urllib.request.urlopen(req, timeout=15) as resp:
                token_data = json.loads(resp.read())
                token_data["obtained_at"] = time.time()
                save_token(token_data)
                print(json.dumps({"status": "authenticated", "message": "Successfully authenticated!"}))
        except Exception as e:
            print(json.dumps({"error": "token_exchange_failed", "message": str(e)}))
            sys.exit(1)
    elif _auth_error:
        print(json.dumps({"error": "auth_denied", "message": f"Auth error: {_auth_error}"}))
        sys.exit(1)
    else:
        print(json.dumps({"error": "timeout", "message": "Authentication timed out."}))
        sys.exit(1)


# ---- Entry Point ----

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "fetch"

    if cmd == "auth":
        start_oauth_flow()

    elif cmd == "fetch":
        result = fetch_all_tasks()
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "status":
        result = check_status()
        print(json.dumps(result))

    elif cmd == "logout":
        delete_token()
        print(json.dumps({"status": "ok", "message": "Logged out successfully."}))

    elif cmd == "complete":
        if len(sys.argv) < 4:
            print(json.dumps({"error": "usage: complete <tasklist_id> <task_id>"}))
            sys.exit(1)
        result = complete_task(sys.argv[2], sys.argv[3], completed=True)
        print(json.dumps(result))

    elif cmd == "uncomplete":
        if len(sys.argv) < 4:
            print(json.dumps({"error": "usage: uncomplete <tasklist_id> <task_id>"}))
            sys.exit(1)
        result = complete_task(sys.argv[2], sys.argv[3], completed=False)
        print(json.dumps(result))

    elif cmd == "create":
        if len(sys.argv) < 4:
            print(json.dumps({"error": "usage: create <tasklist_id> <title>"}))
            sys.exit(1)
        # Title is everything after the tasklist_id (supports spaces)
        title = " ".join(sys.argv[3:])
        result = create_task(sys.argv[2], title)
        print(json.dumps(result))

    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))
        sys.exit(1)
