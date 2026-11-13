# Moves Claude's own popped-out Browser pane window to another monitor and maximizes it.
#   -Watch   keep running; place every Browser pop-out window as it appears
#   -PopOut  if no pop-out exists yet, press the pane's pop-out button in the main window
#   -Place   place the pop-out windows that exist now
#   -List    print the monitors
# Prints JSON lines.
param(
  [switch]$Watch,
  [switch]$PopOut,
  [switch]$Place,
  [switch]$List,
  [switch]$AutoPopOut,
  [int]$Monitor = 2,
  [string]$Title = 'Browser'
)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class SSWin {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hgt, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

  // Visible top-level Chromium windows of the given processes, with their titles.
  public static List<KeyValuePair<long, string>> Windows(HashSet<uint> pids) {
    var list = new List<KeyValuePair<long, string>>();
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid)) return true;
      var cls = new StringBuilder(256); GetClassName(h, cls, 256);
      if (cls.ToString() != "Chrome_WidgetWin_1") return true;
      var title = new StringBuilder(512); GetWindowText(h, title, 512);
      list.Add(new KeyValuePair<long, string>(h.ToInt64(), title.ToString()));
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
'@
[void][SSWin]::SetProcessDPIAware()
Add-Type -AssemblyName System.Windows.Forms

function Emit($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress)); [Console]::Out.Flush() }

function Get-Screens {
  @([System.Windows.Forms.Screen]::AllScreens |
    Sort-Object @{ e = { -not $_.Primary } }, @{ e = { $_.Bounds.X } }, @{ e = { $_.Bounds.Y } })
}

# The desktop app's processes (not the Claude Code CLI, which is also claude.exe).
function Get-AppPids {
  $set = New-Object 'System.Collections.Generic.HashSet[uint32]'
  foreach ($p in (Get-Process -Name claude -ErrorAction SilentlyContinue)) {
    $path = $null; try { $path = $p.Path } catch {}
    if ($path -and $path -notlike '*\claude-code\*') { [void]$set.Add([uint32]$p.Id) }
  }
  $set
}

function Get-AppWindows { [SSWin]::Windows((Get-AppPids)) }
function Get-PopOuts { @(Get-AppWindows | Where-Object { $_.Value -eq $Title }) }

function Move-ToTarget([long]$hwnd) {
  $screens = Get-Screens
  if ($screens.Count -lt 2) { return @{ ok = $false; reason = 'no-second-screen' } }
  $idx = [Math]::Min([Math]::Max($Monitor, 2), $screens.Count) - 1
  $wa = $screens[$idx].WorkingArea
  $h = [IntPtr]::new($hwnd)
  for ($try = 0; $try -lt 3; $try++) {
    [void][SSWin]::ShowWindow($h, 9)  # SW_RESTORE, so the move is not undone by the maximized state
    [void][SSWin]::SetWindowPos($h, [IntPtr]::Zero, $wa.X + 20, $wa.Y + 20, [Math]::Max(400, $wa.Width - 40), [Math]::Max(300, $wa.Height - 40), 0x0014)
    [void][SSWin]::ShowWindow($h, 3)  # SW_MAXIMIZE on the monitor it now sits on
    Start-Sleep -Milliseconds 600
    $r = New-Object SSWin+RECT; [void][SSWin]::GetWindowRect($h, [ref]$r)
    $cx = ($r.Left + $r.Right) / 2; $cy = ($r.Top + $r.Bottom) / 2
    $onTarget = $cx -ge $wa.Left -and $cx -lt $wa.Right -and $cy -ge $wa.Top -and $cy -lt $wa.Bottom
    if ($onTarget -and [SSWin]::IsZoomed($h)) { return @{ ok = $true; hwnd = $hwnd; monitor = $idx + 1 } }
  }
  @{ ok = $false; reason = 'not-placed'; hwnd = $hwnd }
}

if ($List) {
  Emit @{ ok = $true; screens = @(Get-Screens | ForEach-Object { @{ name = $_.DeviceName; primary = $_.Primary; w = $_.Bounds.Width; h = $_.Bounds.Height } }); popouts = (Get-PopOuts).Count }
  exit 0
}

if ($Place) {
  $found = Get-PopOuts
  if ($found.Count -eq 0) { Emit @{ ok = $false; reason = 'no-popout' } }
  foreach ($w in $found) { Emit (Move-ToTarget $w.Key) }
  exit 0
}

# ---- the Browser pane inside the main window -------------------------------
# Its header row is marked by "Browser-Einstellungen" (the ... menu); the button
# left of the pane's close button ("Erweitern") shows the layout options on
# hover, the last of them "In neuem Fenster oeffnen". ASCII only below:
# Windows PowerShell reads a BOM-less script as ANSI, so umlauts are matched by '.'.
$script:uia = $false
function Use-Uia {
  if (-not $script:uia) { Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes; $script:uia = $true }
}
$anchorNames = '^(Browser-Einstellungen|Browser settings)$'
$hoverNames = '^(Erweitern|Expand|Maximize|Maximieren)$'
$popNames = '^(In neuem Fenster .ffnen|Open in new window|Open in a new window)$'

# The main windows (not a pop-out) whose Browser pane is on screen.
function Get-PaneHosts {
  Use-Uia
  $A = [System.Windows.Automation.AutomationElement]
  $cond = New-Object System.Windows.Automation.AndCondition(
    (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)),
    (New-Object System.Windows.Automation.PropertyCondition($A::IsOffscreenProperty, $false)))
  $hosts = @()
  foreach ($w in (Get-AppWindows | Where-Object { $_.Value -ne $Title })) {
    try {
      $root = $A::FromHandle([IntPtr]::new($w.Key))
      $anchor = @($root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)) |
        Where-Object { $_.Current.Name -match $anchorNames } | Select-Object -First 1
      if ($anchor) { $hosts += ,@($root, $anchor) }
    } catch {}
  }
  ,$hosts
}

# Hovers the pane's Erweitern button and presses "In neuem Fenster oeffnen".
# Returns the pressed button's name, or $null.
function Invoke-PopOut {
  Use-Uia
  $A = [System.Windows.Automation.AutomationElement]
  $TS = [System.Windows.Automation.TreeScope]
  $buttonCond = New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
  # Chromium builds its accessibility tree on the first query, so ask a few times.
  for ($try = 0; $try -lt 4; $try++) {
    foreach ($pair in (Get-PaneHosts)) {
      $root = $pair[0]; $rowY = $pair[1].Current.BoundingRectangle.Y
      $hover = @($root.FindAll($TS::Descendants, $buttonCond)) |
        Where-Object { $_.Current.Name -match $hoverNames -and [Math]::Abs($_.Current.BoundingRectangle.Y - $rowY) -le 8 } |
        Select-Object -First 1
      if (-not $hover) { continue }
      $r = $hover.Current.BoundingRectangle
      $was = New-Object SSWin+POINT; [void][SSWin]::GetCursorPos([ref]$was)
      try {
        [void][SSWin]::SetCursorPos([int]($r.X + $r.Width / 2), [int]($r.Y + $r.Height / 2))
        for ($wait = 0; $wait -lt 8; $wait++) {
          Start-Sleep -Milliseconds 150
          $pop = @($root.FindAll($TS::Descendants, $buttonCond)) | Where-Object { $_.Current.Name -match $popNames } | Select-Object -First 1
          if ($pop) {
            $pop.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
            return $pop.Current.Name
          }
        }
      } finally {
        Start-Sleep -Milliseconds 100
        [void][SSWin]::SetCursorPos($was.X, $was.Y)
      }
    }
    Start-Sleep -Milliseconds 500
  }
  $null
}

if ($PopOut) {
  if ((Get-PopOuts).Count -gt 0) { Emit @{ ok = $true; already = $true }; exit 0 }
  $pressed = Invoke-PopOut
  if (-not $pressed) { Emit @{ ok = $false; reason = 'no-popout-button' }; exit 0 }
  # Place it here too, in case no watcher runs.
  $deadline = (Get-Date).AddSeconds(5)
  while ((Get-Date) -lt $deadline) {
    $found = Get-PopOuts
    if ($found.Count -gt 0) { Start-Sleep -Milliseconds 300; Emit (Move-ToTarget $found[0].Key); exit 0 }
    Start-Sleep -Milliseconds 150
  }
  Emit @{ ok = $false; reason = 'popout-window-not-found'; pressed = $pressed }
  exit 0
}

if ($Watch) {
  # Every Claude Code session that loads the mod starts a watcher; only one may act.
  # The others wait here and take over when the active one's session ends (a killed
  # owner leaves the mutex abandoned, which WaitOne reports as acquired).
  $mutex = New-Object System.Threading.Mutex($false, 'Local\ClaudeSecondScreenPreviewWatcher')
  $owned = $false
  $announced = $false
  while (-not $owned) {
    try { $owned = $mutex.WaitOne(2000) } catch {
      # PowerShell wraps it in a MethodInvocationException.
      $ex = $_.Exception
      if ($ex -is [System.Threading.AbandonedMutexException] -or $ex.InnerException -is [System.Threading.AbandonedMutexException]) { $owned = $true } else { throw }
    }
    if (-not $owned -and -not $announced) { Emit @{ ok = $true; waiting = $true }; $announced = $true }
  }
  $seen = New-Object 'System.Collections.Generic.HashSet[long]'
  $lastGone = [datetime]::MinValue      # when a pop-out window last closed
  $paneWasShown = $true                 # only a pane opened after the start counts as new
  $tick = 0
  Emit @{ ok = $true; watching = $true; autoPopOut = [bool]$AutoPopOut }
  while ($true) {
    try {
      # 1. Every Browser pop-out window that appears goes to the target monitor, maximized.
      $pops = Get-PopOuts
      foreach ($w in $pops) {
        if ($seen.Add($w.Key)) {
          Start-Sleep -Milliseconds 300   # let the app finish sizing the new window
          $res = Move-ToTarget $w.Key
          $res.event = 'placed'
          Emit $res
        }
      }
      # A pop-out that is gone or merely hidden (the app may hide it when docking back)
      # counts as closed: placed again when it shows, and docking back is noticed.
      $visible = @($pops | ForEach-Object { $_.Key })
      foreach ($k in @($seen)) {
        if ($visible -notcontains $k) { [void]$seen.Remove($k); $lastGone = Get-Date }
      }

      # 2. A Browser pane newly shown in the main window (the chat's Open button, a
      #    tool call) is popped out. One that comes back because its pop-out window
      #    just closed ("Im Hauptfenster oeffnen") is left docked until it is closed
      #    and opened again.
      if ($AutoPopOut -and ($tick % 3) -eq 0) {
        $shown = (Get-PaneHosts).Count -gt 0
        $dockedBack = ((Get-Date) - $lastGone).TotalSeconds -lt 4
        if ($shown -and -not $paneWasShown -and $pops.Count -eq 0 -and -not $dockedBack) {
          $pressed = Invoke-PopOut
          if (-not $pressed) { Emit @{ ok = $false; event = 'popout'; reason = 'no-popout-button' } }
        }
        $paneWasShown = $shown
      }
    } catch { Emit @{ ok = $false; reason = "$_" } }
    $tick++
    Start-Sleep -Milliseconds 400
  }
}
