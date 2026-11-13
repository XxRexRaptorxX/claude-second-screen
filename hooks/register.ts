import type { EngineInterface, ProcessSpawnChunk, Register } from 'claude-code'

// What this module does (see README, "What the mod runs and sends"):
// - session.start: registers the /second-screen command and starts the watcher,
//   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <mod>/scripts/second-screen.ps1 -Watch ...`,
//   which moves the Claude desktop app's Browser pop-out window to another monitor.
// - command.run on second-screen: shows and changes the settings (kept in $.store).
// Nothing is sent over the network.

type Settings = {
  enabled: boolean
  monitor: number
  autoPopOut: boolean
}

type Line = { ok: boolean; reason?: string; monitor?: number; event?: string }

const DEFAULTS: Settings = { enabled: true, monitor: 2, autoPopOut: true }

// The running watcher; module variables start over on a reload, and the
// engine kills a spawned child when its module unloads.
let watcher: AsyncIterator<ProcessSpawnChunk> | undefined

async function settings($: EngineInterface): Promise<Settings> {
  const stored = (await $.store.get('settings')) as Partial<Settings> | undefined
  return { ...DEFAULTS, ...(stored ?? {}) }
}

async function saveSettings($: EngineInterface, patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await settings($)), ...patch }
  await $.store.set('settings', next)
  return next
}

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

function explain(reason: string | undefined): string {
  switch (reason) {
    case 'no-second-screen': return 'no second monitor found / kein zweiter Bildschirm gefunden'
    case 'no-popout': return 'no Browser window is popped out / kein ausgelagertes Browser-Fenster offen'
    case 'no-popout-button': return 'pop-out option not found, pop the pane out by hand / „In neuem Fenster öffnen“ nicht gefunden'
    case 'not-placed': return 'the window could not be moved / Fenster ließ sich nicht verschieben'
    default: return reason ?? 'unknown error'
  }
}

// Places the Browser pop-out windows that are open now (the /second-screen place command).
async function placeNow($: EngineInterface, monitor: number): Promise<Line> {
  const { stdout } = await $.process.run(
    ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/scripts/second-screen.ps1`, '-Place', '-Monitor', String(monitor)],
    { timeoutMs: 30_000 },
  )
  return parseLines(stdout).pop() ?? { ok: false, reason: 'no output' }
}

// Reads the watcher's JSON lines and shows them as toasts.
async function pumpWatcher($: EngineInterface, it: AsyncIterator<ProcessSpawnChunk>) {
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
        if (line.event === 'placed' && line.ok) $.ui.toast(`Browser window maximized on monitor ${line.monitor}`)
        else if ((line.event === 'placed' || line.event === 'popout') && !line.ok) $.ui.toast(`Second screen: ${explain(line.reason)}`)
      }
    }
  } catch (err) {
    $.ui.log(`second-screen watcher: ${String(err)}`, { to: 'debug' })
  } finally {
    if (watcher === it) watcher = undefined
  }
}

async function stopWatcher() {
  const it = watcher
  watcher = undefined
  await it?.return?.()
}

// Starts the watcher: a PowerShell loop that maximizes every Browser pop-out
// window on the chosen monitor and, with -PopOutMode auto, pops a newly shown
// Browser pane out of the main window.
async function startWatcher($: EngineInterface) {
  await stopWatcher()
  const s = await settings($)
  if (!s.enabled) return
  const stream = $.process.spawn({
    argv: ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/scripts/second-screen.ps1`, '-Watch', '-Monitor', String(s.monitor), '-PopOutMode', s.autoPopOut ? 'auto' : 'off'],
  })
  const it = stream[Symbol.asyncIterator]()
  watcher = it
  void pumpWatcher($, it)
}

function describe(s: Settings): string {
  return [
    `Second screen: ${s.enabled ? 'on' : 'off'} (monitor ${s.monitor})`,
    `Pop the Browser pane out automatically: ${s.autoPopOut ? 'yes' : 'no'}`,
    '',
    '/second-screen on|off · monitor <n> · popout on|off · place',
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'second-screen',
      description: 'Browser window on the second monitor: status and settings',
      argumentHint: 'on|off|monitor <n>|popout on|off|place',
    })
    await startWatcher($)
    return started
  })

  on('command.run', { command: 'second-screen' }, async ($, e) => {
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
        if (!Number.isFinite(n) || n < 2) return { text: 'Monitor 2 or higher, e.g. /second-screen monitor 2' }
        s = await saveSettings($, { monitor: n })
        await startWatcher($)
        break
      }
      case 'popout':
        if (arg !== 'on' && arg !== 'off') return { text: '/second-screen popout on | /second-screen popout off' }
        s = await saveSettings($, { autoPopOut: arg === 'on' })
        await startWatcher($)
        break
      case 'place': {
        const res = await placeNow($, s.monitor)
        return { text: res.ok ? `Browser window maximized on monitor ${res.monitor}.` : `Not done: ${explain(res.reason)}` }
      }
      default:
        return { text: `Unknown: ${word}\n\n${describe(s)}` }
    }
    return { text: describe(s) }
  })
}
