/**
 * Google Tasks Desklet for Linux Mint Cinnamon
 *
 * Displays Google Tasks on the desktop with a transparent glassmorphism theme.
 * Supports OAuth2 login, task list switching, task completion toggling,
 * and auto-refresh.
 */

const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

// Path to the Python backend script
const DESKLET_DIR = imports.ui.deskletManager.deskletMeta["google-tasks@desklet"].path;
const PYTHON_SCRIPT = DESKLET_DIR + "/google_tasks_api.py";

function GoogleTasksDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

GoogleTasksDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function (metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

        this._metadata = metadata;
        this._desklet_id = desklet_id;

        // State
        this._taskData = null;
        this._activeListIndex = 0;
        this._isLoading = false;
        this._lastUpdated = null;
        this._refreshTimeout = null;
        this._authInProgress = false;

        // Settings
        try {
            this._settings = new Settings.DeskletSettings(this, this._metadata.uuid, desklet_id);
            this._settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-completed",
                "_showCompleted",
                this._render.bind(this),
                null
            );
            this._settings.bindProperty(
                Settings.BindingDirection.IN,
                "refresh-interval",
                "_refreshIntervalMinutes",
                this._setupRefresh.bind(this),
                null
            );
        } catch (e) {
            this._showCompleted = false;
            this._refreshIntervalMinutes = 5;
        }

        this._buildUI();
        this._checkStatusAndLoad();
        this._setupRefresh();
    },

    // ---- UI Construction ----

    _buildUI: function () {
        this._mainBox = new St.BoxLayout({
            style_class: "gt-panel",
            vertical: true,
            reactive: true,
        });
        this.setContent(this._mainBox);
        this._renderLoading("Initializing...");
    },

    _clearMain: function () {
        this._mainBox.destroy_all_children();
    },

    // ---- Header ----

    _buildHeader: function (subtitle) {
        let header = new St.BoxLayout({
            style_class: "gt-header",
            vertical: false,
        });

        // Left: title + subtitle
        let titleBox = new St.BoxLayout({ vertical: true });
        let titleLabel = new St.Label({
            text: "\u2713 Google Tasks",
            style_class: "gt-title",
        });
        titleBox.add_actor(titleLabel);

        if (subtitle) {
            let subLabel = new St.Label({
                text: subtitle,
                style_class: "gt-subtitle",
            });
            titleBox.add_actor(subLabel);
        }

        header.add(titleBox, { expand: true });

        // Right: action buttons
        let btnBox = new St.BoxLayout({ vertical: false, style: "spacing: 4px;" });

        // Refresh button
        let refreshBtn = new St.Button({
            style_class: "gt-icon-btn",
            label: "\u21BB",
            reactive: true,
        });
        refreshBtn.connect("clicked", Lang.bind(this, this._onRefreshClicked));
        btnBox.add_actor(refreshBtn);

        // Logout button
        let logoutBtn = new St.Button({
            style_class: "gt-logout-btn",
            label: "Logout",
            reactive: true,
        });
        logoutBtn.connect("clicked", Lang.bind(this, this._onLogoutClicked));
        btnBox.add_actor(logoutBtn);

        header.add(btnBox, { y_align: St.Align.MIDDLE, y_fill: false });
        return header;
    },

    // ---- Render States ----

    _renderLoading: function (msg) {
        this._clearMain();
        let loadBox = new St.BoxLayout({
            style_class: "gt-loading",
            vertical: true,
        });
        let label = new St.Label({
            text: msg || "Loading tasks\u2026",
            style_class: "gt-loading-label",
        });
        loadBox.add_actor(label);
        this._mainBox.add_actor(loadBox);
    },

    _renderLogin: function (hasCredentials, message) {
        this._clearMain();

        let loginBox = new St.BoxLayout({
            style_class: "gt-login-box",
            vertical: true,
        });

        let iconLabel = new St.Label({
            text: "G",
            style_class: "gt-login-icon",
        });
        loginBox.add(iconLabel, { x_align: St.Align.MIDDLE });

        let title = new St.Label({
            text: "Google Tasks",
            style_class: "gt-login-title",
        });
        loginBox.add(title, { x_align: St.Align.MIDDLE });

        if (!hasCredentials) {
            this._renderNoCredentials(loginBox);
        } else {
            let desc = new St.Label({
                text: message || "Sign in to view your tasks",
                style_class: "gt-login-desc",
            });
            loginBox.add(desc, { x_align: St.Align.MIDDLE });

            let signInBtn = new St.Button({
                style_class: "gt-login-btn",
                label: "Sign in with Google",
                reactive: true,
            });
            signInBtn.connect("clicked", Lang.bind(this, this._onSignInClicked));
            loginBox.add(signInBtn, { x_align: St.Align.MIDDLE });
        }

        this._mainBox.add_actor(loginBox);
    },

    _renderNoCredentials: function (container) {
        let warnBox = new St.BoxLayout({
            style_class: "gt-warn-box",
            vertical: true,
        });

        let warnTitle = new St.Label({
            text: "\u26A0 Setup Required",
            style_class: "gt-warn-title",
        });
        warnBox.add_actor(warnTitle);

        let steps = [
            "1. Go to console.cloud.google.com",
            "2. Create a project & enable Tasks API",
            "3. Create OAuth2 credentials (Desktop)",
            "4. Download as client_secret.json",
            "5. Place in ~/.config/google-tasks-desklet/",
        ];

        for (let i = 0; i < steps.length; i++) {
            let lbl = new St.Label({ text: steps[i], style_class: "gt-warn-text" });
            warnBox.add_actor(lbl);
        }

        let guideBtn = new St.Button({
            style_class: "gt-login-btn",
            label: "Open Setup Guide",
            reactive: true,
        });
        guideBtn.connect("clicked", function () {
            Util.spawnCommandLine(
                "xdg-open https://console.cloud.google.com/apis/library/tasks.googleapis.com"
            );
        });
        warnBox.add(guideBtn, { x_align: St.Align.MIDDLE });

        container.add_actor(warnBox);
    },

    _renderError: function (message) {
        this._clearMain();
        let header = this._buildHeader(null);
        this._mainBox.add_actor(header);

        let errBox = new St.BoxLayout({
            style_class: "gt-warn-box",
            vertical: true,
        });
        let errLabel = new St.Label({
            text: "\u274C " + (message || "An error occurred"),
            style_class: "gt-warn-text",
        });
        errBox.add_actor(errLabel);

        let retryBtn = new St.Button({
            style_class: "gt-login-btn",
            label: "Retry",
            reactive: true,
        });
        retryBtn.connect("clicked", Lang.bind(this, this._checkStatusAndLoad));
        errBox.add(retryBtn, { x_align: St.Align.MIDDLE });

        this._mainBox.add_actor(errBox);
    },

    // ---- Main Task Render ----

    _render: function () {
        if (!this._taskData) {
            this._renderLoading("Loading\u2026");
            return;
        }

        let data = this._taskData;

        if (data.error) {
            if (data.error === "not_authenticated" || data.error === "auth_expired") {
                this._renderLogin(true, data.message);
            } else if (data.error === "no_credentials") {
                this._renderLogin(false, null);
            } else {
                this._renderError(data.message);
            }
            return;
        }

        this._clearMain();

        let tasklists = data.tasklists || [];
        if (tasklists.length === 0) {
            this._renderEmptyAccount();
            return;
        }

        // Clamp active index
        if (this._activeListIndex >= tasklists.length) {
            this._activeListIndex = 0;
        }

        let activeList = tasklists[this._activeListIndex];

        // Header
        let updatedStr = this._lastUpdated
            ? "Updated " + this._formatTime(this._lastUpdated)
            : "";
        let header = this._buildHeader(updatedStr);
        this._mainBox.add_actor(header);

        // Tab bar (task list selector)
        if (tasklists.length > 1) {
            let tabBar = this._buildTabBar(tasklists);
            this._mainBox.add_actor(tabBar);
        }

        // Task content - use ScrollView properly
        let scrollView = new St.ScrollView({
            style_class: "gt-scroll",
        });
        scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        scrollView.set_height(400);

        let taskContainer = new St.BoxLayout({
            style_class: "gt-task-list",
            vertical: true,
        });
        scrollView.add_actor(taskContainer);

        let tasks = activeList.tasks || [];
        let filteredTasks = this._showCompleted
            ? tasks
            : tasks.filter(function (t) { return t.status !== "completed"; });

        if (filteredTasks.length === 0) {
            let emptyLabel = new St.Label({
                text: tasks.length === 0 ? "No tasks \u2014 you're all caught up!" : "No pending tasks",
                style_class: "gt-empty-label",
            });
            taskContainer.add_actor(emptyLabel);
        } else {
            for (let i = 0; i < filteredTasks.length; i++) {
                let task = filteredTasks[i];
                this._addTaskRow(taskContainer, task, activeList.id, false);

                // Subtasks
                if (task.subtasks && task.subtasks.length > 0) {
                    let subs = task.subtasks;
                    if (!this._showCompleted) {
                        subs = subs.filter(function (s) { return s.status !== "completed"; });
                    }
                    for (let j = 0; j < subs.length; j++) {
                        this._addTaskRow(taskContainer, subs[j], activeList.id, true);
                    }
                }
            }
        }

        this._mainBox.add_actor(scrollView);

        // Status bar
        let statusBar = this._buildStatusBar(activeList);
        this._mainBox.add_actor(statusBar);
    },

    _buildTabBar: function (tasklists) {
        let tabBar = new St.BoxLayout({
            style_class: "gt-tabs",
            vertical: false,
        });

        for (let i = 0; i < tasklists.length; i++) {
            let tl = tasklists[i];
            let isActive = (i === this._activeListIndex);
            let tab = new St.Button({
                style_class: isActive ? "gt-tab gt-tab-active" : "gt-tab",
                label: tl.title,
                reactive: true,
            });
            let idx = i;
            tab.connect("clicked", Lang.bind(this, function () {
                this._activeListIndex = idx;
                this._render();
            }));
            tabBar.add_actor(tab);
        }

        return tabBar;
    },



    _addTaskRow: function (container, task, listId, isSubtask) {
        let isDone = task.status === "completed";

        // Build the row as a horizontal box
        let row = new St.BoxLayout({
            vertical: false,
            reactive: true,
            style: isSubtask
                ? "padding: 4px 10px 4px 26px;"
                : "padding: 7px 10px; border-radius: 10px;",
        });

        // Checkbox — use inline style to guarantee size
        let checkStyle = "min-width: 18px; max-width: 18px; min-height: 18px; max-height: 18px; "
            + "border-radius: 5px; padding: 0; margin-right: 10px; font-size: 11px; ";
        if (isDone) {
            checkStyle += "border: 1px solid rgba(102, 187, 106, 0.6); "
                + "background-color: rgba(102, 187, 106, 0.15); color: rgba(102, 187, 106, 0.9);";
        } else {
            checkStyle += "border: 1px solid rgba(79, 195, 247, 0.5); "
                + "background-color: rgba(255, 255, 255, 0.04);";
        }

        let checkBtn = new St.Button({
            label: isDone ? "\u2714" : "",
            style: checkStyle,
            reactive: true,
        });

        let taskId = task.id;
        let taskListId = listId;
        checkBtn.connect("clicked", Lang.bind(this, function () {
            this._onToggleTask(taskListId, taskId, isDone);
        }));

        row.add(checkBtn, { y_align: St.Align.MIDDLE, y_fill: false, x_fill: false });

        // Task title
        let titleColor = isDone ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)";
        let fontSize = isSubtask ? "12px" : "13px";
        let titleStyle = "font-size: " + fontSize + "; color: " + titleColor + ";";
        if (isDone) titleStyle += " text-decoration: line-through;";

        let titleText = task.title || "(no title)";

        // Add due date inline if present
        if (task.due && !isDone) {
            let dueInfo = this._parseDue(task.due);
            if (dueInfo.text) {
                titleText += "\n" + dueInfo.text;
            }
        }

        let titleLabel = new St.Label({
            text: titleText,
            style: titleStyle,
        });

        row.add(titleLabel, { expand: true, y_align: St.Align.MIDDLE, y_fill: false });
        container.add_actor(row);
    },

    _buildStatusBar: function (activeList) {
        let bar = new St.BoxLayout({
            style_class: "gt-statusbar",
            vertical: false,
        });

        let tasks = activeList.tasks || [];
        let total = tasks.length;
        let done = tasks.filter(function (t) { return t.status === "completed"; }).length;
        let pending = total - done;

        let statsLabel = new St.Label({
            text: pending + " pending  \u00B7  " + done + " done",
            style_class: "gt-status-label gt-status-ok",
        });
        bar.add(statsLabel, { expand: true });

        return bar;
    },

    _renderEmptyAccount: function () {
        this._clearMain();
        let header = this._buildHeader("No task lists found");
        this._mainBox.add_actor(header);

        let emptyBox = new St.BoxLayout({
            style_class: "gt-empty",
            vertical: true,
        });
        let label = new St.Label({
            text: "Your Google account has no task lists.\nCreate one in Google Tasks to get started.",
            style_class: "gt-empty-label",
        });
        emptyBox.add(label, { x_align: St.Align.MIDDLE });
        this._mainBox.add_actor(emptyBox);
    },

    // ---- Data Loading ----

    _checkStatusAndLoad: function () {
        this._runPython(["status"], Lang.bind(this, function (result) {
            if (!result) {
                this._renderError("Could not run Python backend. Is Python3 installed?");
                return;
            }

            let status = result.status;
            if (status === "authenticated") {
                this._loadTasks();
            } else if (status === "no_credentials") {
                this._renderLogin(false, null);
            } else {
                this._renderLogin(true, result.message);
            }
        }));
    },

    _loadTasks: function () {
        if (this._isLoading) return;
        this._isLoading = true;
        this._renderLoading("Fetching tasks\u2026");

        this._runPython(["fetch"], Lang.bind(this, function (result) {
            this._isLoading = false;
            if (!result) {
                this._renderError("Failed to fetch tasks. Check your network connection.");
                return;
            }
            this._taskData = result;
            this._lastUpdated = new Date();
            this._render();
        }));
    },

    // ---- Actions ----

    _onRefreshClicked: function () {
        this._taskData = null;
        this._loadTasks();
    },

    _onSignInClicked: function () {
        if (this._authInProgress) return;
        this._authInProgress = true;
        this._renderLoading("Opening browser for Google sign-in\u2026");

        this._runPython(["auth"], Lang.bind(this, function (result) {
            this._authInProgress = false;
            if (result && result.status === "authenticated") {
                this._loadTasks();
            } else {
                let msg = result ? result.message : "Authentication failed";
                this._renderLogin(true, msg);
            }
        }));
    },

    _onLogoutClicked: function () {
        this._runPython(["logout"], Lang.bind(this, function () {
            this._taskData = null;
            this._renderLogin(true, "Signed out successfully.");
        }));
    },

    _onToggleTask: function (listId, taskId, currentlyDone) {
        let cmd = currentlyDone ? "uncomplete" : "complete";
        this._runPython([cmd, listId, taskId], Lang.bind(this, function (result) {
            if (result && result.status === "ok") {
                this._updateTaskStatus(listId, taskId, !currentlyDone);
                this._render();
            }
        }));
    },

    _updateTaskStatus: function (listId, taskId, completed) {
        if (!this._taskData || !this._taskData.tasklists) return;
        let status = completed ? "completed" : "needsAction";
        this._taskData.tasklists.forEach(function (tl) {
            if (tl.id !== listId) return;
            tl.tasks.forEach(function (task) {
                if (task.id === taskId) task.status = status;
                (task.subtasks || []).forEach(function (sub) {
                    if (sub.id === taskId) sub.status = status;
                });
            });
        });
    },

    // ---- Auto Refresh ----

    _setupRefresh: function () {
        if (this._refreshTimeout) {
            Mainloop.source_remove(this._refreshTimeout);
            this._refreshTimeout = null;
        }
        let interval = (this._refreshIntervalMinutes || 5) * 60;
        this._refreshTimeout = Mainloop.timeout_add_seconds(
            interval,
            Lang.bind(this, function () {
                if (this._taskData && !this._taskData.error && !this._isLoading) {
                    this._loadTasks();
                }
                return true;
            })
        );
    },

    // ---- Python Subprocess ----

    _runPython: function (args, callback) {
        let cmdArgs = ["python3", PYTHON_SCRIPT].concat(args);
        let output = "";
        let hasError = false;

        try {
            let [success, pid, stdin_fd, stdout_fd, stderr_fd] = GLib.spawn_async_with_pipes(
                null,
                cmdArgs,
                null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );

            let stdoutStream = new Gio.DataInputStream({
                base_stream: new Gio.UnixInputStream({ fd: stdout_fd, close_fd: true }),
            });

            let readLine = Lang.bind(this, function () {
                stdoutStream.read_line_async(
                    GLib.PRIORITY_DEFAULT,
                    null,
                    Lang.bind(this, function (stream, result) {
                        try {
                            let [line] = stream.read_line_finish_utf8(result);
                            if (line !== null) {
                                output += line + "\n";
                                readLine();
                            } else {
                                // EOF
                                try {
                                    let parsed = JSON.parse(output.trim());
                                    callback(parsed);
                                } catch (e) {
                                    callback(null);
                                }
                            }
                        } catch (e) {
                            if (!hasError) {
                                hasError = true;
                                callback(null);
                            }
                        }
                    })
                );
            });

            readLine();

            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function () {
                GLib.spawn_close_pid(pid);
            });

        } catch (e) {
            callback(null);
        }
    },

    // ---- Utilities ----

    _formatTime: function (date) {
        let now = new Date();
        let diffMs = now - date;
        let diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return "just now";
        if (diffSec < 3600) return Math.floor(diffSec / 60) + "m ago";
        return Math.floor(diffSec / 3600) + "h ago";
    },

    _parseDue: function (dueStr) {
        if (!dueStr) return { text: "", overdue: false };
        let due = new Date(dueStr);
        let now = new Date();
        let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

        let diffDays = Math.round((dueDay - today) / 86400000);

        let text;
        let overdue = false;

        if (diffDays < 0) {
            overdue = true;
            text = "\u26A0 Overdue by " + Math.abs(diffDays) + (Math.abs(diffDays) === 1 ? " day" : " days");
        } else if (diffDays === 0) {
            text = "\u23F0 Due today";
        } else if (diffDays === 1) {
            text = "Due tomorrow";
        } else if (diffDays <= 7) {
            let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            text = "Due " + days[dueDay.getDay()];
        } else {
            text = "Due " + due.toLocaleDateString();
        }

        return { text: text, overdue: overdue };
    },

    // ---- Cleanup ----

    on_desklet_removed: function () {
        if (this._refreshTimeout) {
            Mainloop.source_remove(this._refreshTimeout);
            this._refreshTimeout = null;
        }
    },
};

function main(metadata, desklet_id) {
    return new GoogleTasksDesklet(metadata, desklet_id);
}
