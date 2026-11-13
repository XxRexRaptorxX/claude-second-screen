# How it works

The mod has two parts: a Claude Code hooks module (`hooks/register.ts`) and a Windows PowerShell script (`scripts/second-screen.ps1`) that does the window work the module itself cannot do.

## The hooks module

| Hook | What it does |
| --- | --- |
| `session.start` | Registers the `/second-screen` command and starts the watcher (`second-screen.ps1 -Watch`). |
| `tool.call` on `mcp__Claude_Browser__preview_start` and `mcp__Claude_Browser__navigate` | After the call succeeds, runs `second-screen.ps1 -PopOut` outside the tool call, so Claude is never held up. |
| `command.run` on `second-screen` | Reads and changes the settings, kept with `$.store` across sessions. |

The watcher is a child process of the session: it ends with the session or when the mod reloads.

## The script

`second-screen.ps1` has four modes:

| Mode | What it does |
| --- | --- |
| `-Watch [-AutoPopOut]` | Runs until stopped. Every 0.4 s it lists the desktop app's visible windows; a new window titled `Browser` is moved to the target monitor and maximized. With `-AutoPopOut`, about once a second it also asks Windows UI Automation whether the Browser pane is shown in a main window, and pops a newly shown pane out. |
| `-PopOut` | Pops the pane out once (if no pop-out window exists yet) and places the new window. |
| `-Place` | Places the Browser windows that are open now. |
| `-List` | Prints the monitors and how many pop-out windows are open. |

Each mode prints JSON lines, which the module turns into toasts.

### Popping the pane out

The pane's header row is found by its **Browser-Einstellungen** / **Browser settings** button. The button left of the pane's close button (**Erweitern** / **Expand**) shows the layout options only on hover, so the script moves the pointer onto it, waits for **In neuem Fenster öffnen** / **Open in new window**, invokes it through UI Automation and puts the pointer back.

### Placing the window

The script restores the window, moves it into the target monitor's working area with `SetWindowPos`, maximizes it with `ShowWindow`, and checks the result, up to three times. Monitors are counted with the main monitor as 1 and the others left to right.

### Docking back

When a pop-out window disappears (the app hides it when you choose **Im Hauptfenster öffnen**) and the pane shows up in the main window within 4 seconds, the watcher leaves it docked. Only a pane that is closed and opened again is popped out.

### One watcher at a time

Every session that loads the mod starts a watcher. They share the named mutex `Local\ClaudeSecondScreenPreviewWatcher`: one acts, the others wait and take over when its session ends.

## What it touches

- Window positions and sizes of the Claude desktop app's `Browser` windows.
- The mouse pointer, for about a second while popping out.
- Nothing on disk besides the mod's own settings in Claude Code's plugin store. No network access.
