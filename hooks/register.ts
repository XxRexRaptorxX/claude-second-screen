import type { EngineInterface, ProcessSpawnChunk, Register } from 'claude-code'

type $ = EngineInterface

type Settings = {
  enabled: boolean
  monitor: number
  autoPopOut: boolean
}

const DEFAULTS: Settings = { enabled: true, monitor: 2, autoPopOut: true }

const PREVIEW_START = 'mcp__Claude_Browser__preview_start'
const NAVIGATE = 'mcp__Claude_Browser__navigate'
const COMMAND = 'second-screen'

// The running watcher; module variables start over on a reload, and the
// engine kills a spawned child when its module unloads.
let watcher: AsyncIterator<ProcessSpawnChunk> | undefined

async function settings($: $): Promise<Settings> {
  const stored = (await $.store.get('settings')) as Partial<Settings> | undefined
  return { ...DEFAULTS, ...(stored ?? {}) }
}

async function saveSettings($: $, patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await settings($)), ...patch }
  await $.store.set('settings', next)
  return next
}

function scriptArgv(root: string, args: string[]): string[] {
  return [
    'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', `${root}/scripts/second-screen.ps1`, ...args,
  ]
}

type Line = { ok: boolean; reason?: string; monitor?: number; already?: boolean; event?: string }

function parseLines(text: string): Line[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.startsWith('{'))
    .flatMap(l => {
      try {
        return [JSON.parse(l) as Line]
      } catch {
        return []
      }
    })
}

async function runScript($: $, args: string[]): Promise<Line> {
  const argv = scriptArgv($.plugin.root, args)
  const { stdout, stderr, exitCode } = await $.process.run(argv, { timeoutMs: 30_000 })
  return parseLines(stdout).pop() ?? { ok: false, reason: `exit ${exitCode}: ${(stderr || stdout).trim().slice(0, 200)}` }
}

function explain(reason: string | undefined): string {
  switch (reason) {
    case 'no-second-screen': return 'kein zweiter Bildschirm gefunden'
    case 'no-popout': return 'kein ausgelagertes Browser-Fenster offen'
    case 'no-popout-button': return '„In neuem Fenster öffnen“ nicht gefunden (ist der Browser-Pane sichtbar?) – bitte von Hand auslagern'
    case 'popout-window-not-found': return 'das ausgelagerte Fenster ist nicht erschienen'
    case 'not-placed': return 'Fenster ließ sich nicht verschieben'
    default: return reason ?? 'unbekannter Fehler'
  }
}

// Keeps a PowerShell loop running that maximizes every Browser pop-out window
// on the chosen monitor as soon as it appears (also when popped out by hand).
async function startWatcher($: $) {
  await stopWatcher()
  const s = await settings($)
  if (!s.enabled) return
  const args = ['-Watch', '-Monitor', String(s.monitor)]
  if (s.autoPopOut) args.push('-AutoPopOut')
  const argv = scriptArgv($.plugin.root, args)
  const stream = $.process.spawn({ argv })
  const it = stream[Symbol.asyncIterator]()
  watcher = it
  void (async () => {
    let buffered = ''
    try {
      for (;;) {
        const step = await it.next()
        if (step.done) break
        if (step.value.stream !== 'stdout') continue
        buffered += step.value.text
        const cut = buffered.lastIndexOf('\n')
        if (cut < 0) continue
        const lines = parseLines(buffered.slice(0, cut))
        buffered = buffered.slice(cut + 1)
        for (const line of lines) {
          if (line.event === 'popout' && !line.ok) {
            $.ui.toast(`Zweiter Bildschirm: ${explain(line.reason)}`)
            continue
          }
          if (line.event !== 'placed') continue
          if (line.ok) $.ui.toast(`Browser-Fenster auf Monitor ${line.monitor} maximiert`)
          else $.ui.toast(`Zweiter Bildschirm: ${explain(line.reason)}`)
        }
      }
    } catch (err) {
      $.ui.log(`second-screen watcher: ${String(err)}`, { to: 'debug' })
    } finally {
      if (watcher === it) watcher = undefined
    }
  })()
}

async function stopWatcher() {
  const it = watcher
  watcher = undefined
  await it?.return?.()
}

// Runs outside the tool call's dispatch, so the model's call isn't held up.
function later($: $, work: () => Promise<void>) {
  $.clock.after(0, () => {
    work().catch(err => $.ui.log(`second-screen: ${String(err)}`, { to: 'debug' }))
  })
}

async function popOut($: $) {
  const s = await settings($)
  if (!s.enabled || !s.autoPopOut) return
  const res = await runScript($, ['-PopOut', '-Monitor', String(s.monitor)])
  if (!res.ok) $.ui.toast(`Zweiter Bildschirm: ${explain(res.reason)}`)
}

function describe(s: Settings): string {
  return [
    `Zweiter Bildschirm: ${s.enabled ? 'an' : 'aus'} (Monitor ${s.monitor}, maximiert)`,
    `Browser-Pane automatisch auslagern: ${s.autoPopOut ? 'ja' : 'nein'}`,
    '',
    'Befehle: /second-screen on|off · monitor <n> · popout on|off · place',
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: COMMAND,
      description: 'Browser-Fenster auf dem zweiten Bildschirm: Status und Einstellungen',
      argumentHint: 'on|off|monitor <n>|popout on|off|place',
    })
    await startWatcher($)
    return started
  })

  on('tool.call', { tool: PREVIEW_START }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) later($, () => popOut($))
    return ran
  })

  on('tool.call', { tool: NAVIGATE }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) later($, () => popOut($))
    return ran
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const [word = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    let s = await settings($)
    switch (word) {
      case '':
      case 'status':
        break
      case 'on':
      case 'an':
        s = await saveSettings($, { enabled: true })
        await startWatcher($)
        break
      case 'off':
      case 'aus':
        s = await saveSettings($, { enabled: false })
        await stopWatcher()
        break
      case 'monitor': {
        const n = Number.parseInt(arg, 10)
        if (!Number.isFinite(n) || n < 2) return { text: 'Monitor-Nummer ab 2 angeben, z. B. /second-screen monitor 2' }
        s = await saveSettings($, { monitor: n })
        await startWatcher($)
        break
      }
      case 'popout':
        if (arg !== 'on' && arg !== 'off') return { text: '/second-screen popout on  oder  /second-screen popout off' }
        s = await saveSettings($, { autoPopOut: arg === 'on' })
        await startWatcher($)
        break
      case 'place': {
        const res = await runScript($, ['-Place', '-Monitor', String(s.monitor)])
        return { text: res.ok ? `Browser-Fenster auf Monitor ${res.monitor} maximiert.` : `Nicht geklappt: ${explain(res.reason)}` }
      }
      default:
        return { text: `Unbekannt: ${word}\n\n${describe(s)}` }
    }
    return { text: describe(s) }
  })
}
