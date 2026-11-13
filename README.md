# Second Screen Preview – a Claude Code mod

**Keep the chat free: the Claude desktop app's Browser pane opens in its own window, maximized on your second monitor.**

When Claude starts a preview of your dev server, or you open the Browser pane yourself, this mod pops the pane out into its own window and maximizes that window on another monitor. Tabs, address bar and the annotation tools stay as they are; it is the app's own Browser window, not an extra browser.

[Deutsch weiter unten](#deutsch)

## Requirements

- Windows 10 or 11
- The Claude desktop app with Claude Code (the **Code** tab)
- Two or more monitors
- Windows PowerShell 5.1 (part of Windows)

The mod does nothing on macOS or Linux.

## Install

In a Claude Code terminal session:

```
/plugin install second-screen-preview --marketplace XxRexRaptorxX/claude-second-screen
```

Answer `y` to add the marketplace, then pick the **user** scope with Enter. The mod is active right away and in every session you start afterwards.

From a shell:

```bash
claude plugin install second-screen-preview --marketplace XxRexRaptorxX/claude-second-screen
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `XxRexRaptorxX/claude-second-screen`, then **Add plugin**.

Restart the Claude desktop app once after installing, so sessions that were already open pick the mod up too.

## Use

Nothing to do: open a preview or the Browser pane and it lands maximized on monitor 2.

| Command | What it does |
| --- | --- |
| `/second-screen` or `/second-screen status` | Shows the current settings |
| `/second-screen on` / `off` | Turns the mod on or off |
| `/second-screen monitor 3` | Uses another monitor (2 = first one that is not the main monitor, counted left to right) |
| `/second-screen popout on` / `off` | Pop the pane out automatically, or only maximize windows you pop out yourself |
| `/second-screen place` | Moves an open Browser window to the monitor and maximizes it now |

Settings are kept across sessions.

Docking back with **Open in main window** ("Im Hauptfenster öffnen") is respected: the pane stays in the chat until you close it and open it again.

## Good to know

- **The mouse pointer jumps briefly.** The pop-out option only appears while the pointer hovers over the pane's expand button, so the mod moves the pointer there for about a second and puts it back.
- **The pane has to be on screen.** A Browser pane that is open but not shown (another session in front, the window minimized) is popped out once it shows.
- **A little CPU.** A small PowerShell loop checks about once a second whether the pane appeared (each check takes ~0.1 s). However many sessions are open, only one loop does the work.
- **UI labels.** The mod finds the app's buttons by their names, in German and English. A future app update that renames them can break the automatic pop-out; maximizing windows you pop out by hand keeps working.
- **No network, no data.** The mod reads nothing from your projects and sends nothing anywhere. See [docs/how-it-works.md](docs/how-it-works.md).

## Troubleshooting

| Symptom | Try |
| --- | --- |
| Toast: "In neuem Fenster öffnen nicht gefunden" | Make sure the Browser pane is visible in the main window, or pop it out by hand once: the window is still maximized on the monitor. |
| Toast: "kein zweiter Bildschirm gefunden" | Windows sees only one monitor. Check the display settings. |
| The window lands on the wrong monitor | `/second-screen monitor <n>` |
| Nothing happens at all | `/second-screen status` – if the command is unknown, the mod is not loaded: restart the desktop app. |

## Uninstall

```bash
claude plugin uninstall second-screen-preview
```

## License

[MIT](LICENSE)

---

## Deutsch

**Der Chat bleibt frei: Der Browser-Pane der Claude-Desktop-App öffnet sich als eigenes Fenster, maximiert auf dem zweiten Bildschirm.**

Startet Claude eine Vorschau deines Dev-Servers oder öffnest du den Browser-Pane selbst, lagert die Mod ihn in ein eigenes Fenster aus („In neuem Fenster öffnen“) und maximiert dieses auf einem anderen Monitor. Tabs, Adressleiste und Werkzeuge bleiben wie gewohnt; es ist das Browser-Fenster der App selbst, kein zusätzlicher Browser.

### Voraussetzungen

Windows 10/11, die Claude-Desktop-App mit Claude Code, mindestens zwei Bildschirme, Windows PowerShell 5.1 (bei Windows dabei).

### Installieren

In einer Claude-Code-Terminalsitzung:

```
/plugin install second-screen-preview --marketplace XxRexRaptorxX/claude-second-screen
```

Mit `y` den Marketplace hinzufügen, dann den Bereich **user** mit Enter wählen.

In der Desktop-App: **+** neben dem Eingabefeld, dann **Plugins**, **Add marketplace** mit `XxRexRaptorxX/claude-second-screen`, dann **Add plugin**. Danach die App einmal neu starten.

### Bedienen

Nichts zu tun: Vorschau oder Browser-Pane öffnen, das Fenster landet maximiert auf Monitor 2.

- `/second-screen` – Einstellungen anzeigen
- `/second-screen on` / `off` – Mod ein- oder ausschalten
- `/second-screen monitor <n>` – anderen Bildschirm wählen
- `/second-screen popout on` / `off` – automatisch auslagern oder nur von Hand ausgelagerte Fenster maximieren
- `/second-screen place` – offenes Browser-Fenster sofort auf den Monitor schieben

Holst du den Pane mit **Im Hauptfenster öffnen** zurück, bleibt er im Chat, bis du ihn schließt und wieder öffnest.

### Gut zu wissen

- Der Mauszeiger springt beim Auslagern kurz auf den Erweitern-Knopf des Panes und zurück, weil die Option nur beim Hovern erscheint.
- Der Pane muss im Hauptfenster sichtbar sein, damit er ausgelagert werden kann.
- Ein kleiner PowerShell-Wächter prüft etwa einmal pro Sekunde; auch bei mehreren Sitzungen arbeitet nur einer.
- Die Mod findet die Knöpfe der App über ihre Beschriftung (Deutsch und Englisch). Benennt ein App-Update sie um, kann das automatische Auslagern ausfallen; das Maximieren von Hand ausgelagerter Fenster funktioniert weiter.
- Kein Netzwerk, keine Daten: Die Mod liest nichts aus deinen Projekten und sendet nichts.

### Deinstallieren

```bash
claude plugin uninstall second-screen-preview
```
