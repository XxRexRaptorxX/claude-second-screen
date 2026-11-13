# Contributing

Issues and pull requests are welcome.

## Working on the mod

1. Clone the repository.
2. Start Claude Code with the mod loaded from your working copy:

   ```bash
   claude --plugin-dir /path/to/claude-second-screen
   ```

   In the desktop app, name the folder in `CLAUDE_CODE_PLUGIN_DIRS` instead (in the `env` block of `~/.claude/settings.json`). Uninstall the marketplace version first, so the mod is not loaded twice.

3. Check your changes:

   ```bash
   claude plugin validate .
   ```

The PowerShell script can be tried on its own:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/second-screen.ps1 -List
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/second-screen.ps1 -Place -Monitor 2
```

## Two rules for the script

- **Keep `scripts/second-screen.ps1` ASCII-only outside comments.** Windows PowerShell 5.1 reads a script without a byte order mark as ANSI, so an umlaut in a string silently stops matching. Match it with `.` in a regex instead.
- **Match the app's buttons by name in every language you can.** Add an English or other label next to the German one in the `*Names` patterns.

## Releasing

See [docs/RELEASING.md](docs/RELEASING.md).
