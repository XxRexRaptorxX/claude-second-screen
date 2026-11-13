# Changelog

All notable changes to this mod are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.2] - 2026-11-13

- The mod no longer hooks Claude's browser tool calls: the watcher already pops the pane out wherever it comes from.
- Commands and matchers are fixed text; the README now says which program the mod runs, with the exact command lines, what it sends (nothing over the network) and what each hook does.
- The watcher takes `-PopOutMode auto|off` instead of the `-AutoPopOut` switch.

## [1.0.1] - 2026-11-13

- Adds the mod's icon (`.claude-plugin/icon.png`).

## [1.0.0] - 2026-11-13

First public release.

- Pops the Browser pane out into its own window ("In neuem Fenster öffnen" / "Open in new window") when Claude opens a preview or navigates the in-app browser.
- Also pops the pane out when you open it yourself, for example with the **Open** button on a browser card in the chat.
- Moves every Browser pop-out window to the chosen monitor and maximizes it there, including windows you pop out by hand.
- Respects "Im Hauptfenster öffnen" / "Open in main window": a pane you dock back stays docked until you close and reopen it.
- Only one watcher acts at a time, however many Claude Code sessions are open.
- `/second-screen` command: `on`, `off`, `monitor <n>`, `popout on|off`, `place`, `status`.
