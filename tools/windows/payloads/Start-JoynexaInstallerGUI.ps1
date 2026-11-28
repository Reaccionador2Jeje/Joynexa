# Joynexa Installer GUI — edition-aware, read-only diagnostics, current-user setup only.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Run this GUI on Windows after Windows Setup is complete.' }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $root 'joynexa-setup.json'
$installerPath = Join-Path $root 'Install-Joynexa.ps1'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'joynexa-setup.json is missing.' }
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) { throw 'Install-Joynexa.ps1 is missing.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$allowed = @('core','play','productivity','modern','retro','legacy')
if ($manifest.product -ne 'Joynexa Windows' -or $manifest.edition -notin $allowed -or $manifest.schema_version -ne 1) { throw 'Invalid Joynexa setup manifest.' }
if ($manifest.setup.oobe -ne 'interactive' -or $manifest.first_boot.scope -ne 'current_user') { throw 'Setup manifest violates the interactive/current-user safety contract.' }
foreach ($flag in @('windows_requirements_bypassed','eula_auto_accepted','account_auto_created','activation_modified','security_settings_weakened','protected_windows_files_modified')) {
    if ($manifest.safety.$flag -ne $false) { throw "Unsafe manifest flag: $flag" }
}
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Joynexa Installer'; $form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(680,570); $form.MinimumSize = New-Object System.Drawing.Size(680,570)
$form.BackColor = [System.Drawing.Color]::FromArgb(18,26,40); $form.ForeColor = [System.Drawing.Color]::FromArgb(240,245,250)
$form.Font = New-Object System.Drawing.Font('Segoe UI',10)
$title = New-Object System.Windows.Forms.Label
$title.Text = 'JOYNEXA'; $title.Font = New-Object System.Drawing.Font('Segoe UI',24,[System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(75,190,180); $title.Location = New-Object System.Drawing.Point(28,18); $title.Size = New-Object System.Drawing.Size(300,48)
$form.Controls.Add($title)
$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "Windows setup assistant  •  $($manifest.edition_name)"
$subtitle.Location = New-Object System.Drawing.Point(32,68); $subtitle.Size = New-Object System.Drawing.Size(600,26)
$form.Controls.Add($subtitle)
$editionLabel = New-Object System.Windows.Forms.Label
$editionLabel.Text = 'Edition in this setup kit'; $editionLabel.Location = New-Object System.Drawing.Point(32,112); $editionLabel.Size = New-Object System.Drawing.Size(220,24)
$form.Controls.Add($editionLabel)
$edition = New-Object System.Windows.Forms.ComboBox
$edition.DropDownStyle = 'DropDownList'; $edition.Location = New-Object System.Drawing.Point(32,140); $edition.Size = New-Object System.Drawing.Size(590,32)
$edition.Items.AddRange([object[]]@('Core','Play','Productivity','Modern','Retro','Legacy'))
$edition.SelectedItem = (Get-Culture).TextInfo.ToTitleCase([string]$manifest.edition)
$edition.Enabled = $false
$form.Controls.Add($edition)
$hardware = New-Object System.Windows.Forms.TextBox
$hardware.Multiline = $true; $hardware.ReadOnly = $true; $hardware.ScrollBars = 'Vertical'
$hardware.Location = New-Object System.Drawing.Point(32,190); $hardware.Size = New-Object System.Drawing.Size(590,190)
$hardware.BackColor = [System.Drawing.Color]::FromArgb(29,41,59); $hardware.ForeColor = [System.Drawing.Color]::FromArgb(225,235,245)
$hardware.Font = New-Object System.Drawing.Font('Consolas',9); $hardware.Text = 'Reading hardware inventory...'
$form.Controls.Add($hardware)
$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(32,390); $status.Size = New-Object System.Drawing.Size(590,48)
$status.Text = 'Compatibility is not certified by this tool. Check official Microsoft requirements.'
$form.Controls.Add($status)
$diagnose = New-Object System.Windows.Forms.Button
$diagnose.Text = 'Refresh hardware'; $diagnose.Location = New-Object System.Drawing.Point(32,455); $diagnose.Size = New-Object System.Drawing.Size(170,38)
$form.Controls.Add($diagnose)
$apply = New-Object System.Windows.Forms.Button
$apply.Text = 'Apply Joynexa appearance'; $apply.Location = New-Object System.Drawing.Point(390,455); $apply.Size = New-Object System.Drawing.Size(232,38)
$apply.BackColor = [System.Drawing.Color]::FromArgb(39,133,128); $apply.ForeColor = [System.Drawing.Color]::White
$form.Controls.Add($apply)
$refreshHardware = {
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
        $computer = Get-CimInstance Win32_ComputerSystem
        $gpu = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })
        $disk = @(Get-CimInstance Win32_DiskDrive | ForEach-Object { "$($_.Model) — $([math]::Round($_.Size/1GB,1)) GB" })
        $ram = [math]::Round($computer.TotalPhysicalMemory/1GB,2)
        $hardware.Text = @(
            "Operating system : $($os.Caption) ($($os.Version), build $($os.BuildNumber))"
            "Architecture     : $($os.OSArchitecture)"
            "Processor        : $($cpu.Name)"
            "Cores / threads  : $($cpu.NumberOfCores) / $($cpu.NumberOfLogicalProcessors)"
            "Memory           : $ram GiB"
            "Graphics         : $($gpu -join '; ')"
            "Storage          : $($disk -join '; ')"
            ''
            'Advisory only: no compatibility pass/fail is inferred.'
            'No benchmarks, driver changes, or system modifications are performed.'
        ) -join [Environment]::NewLine
    } catch { $hardware.Text = "Hardware inventory unavailable: $($_.Exception.Message)" }
}
$diagnose.Add_Click($refreshHardware)
$apply.Add_Click({
    $message = "Apply $($manifest.edition_name) visual personalization to the current Windows user?" + [Environment]::NewLine + [Environment]::NewLine +
      'This does not install Windows or change activation, accounts, services, security, updates, drivers, or protected system files.'
    $answer = [System.Windows.Forms.MessageBox]::Show($message,'Confirm Joynexa setup',[System.Windows.Forms.MessageBoxButtons]::YesNo,[System.Windows.Forms.MessageBoxIcon]::Question)
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }
    try {
        $apply.Enabled = $false
        & (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoProfile -ExecutionPolicy RemoteSigned -File $installerPath
        if ($LASTEXITCODE -ne 0) { throw "Installer exited with code $LASTEXITCODE." }
        [System.Windows.Forms.MessageBox]::Show('Joynexa setup process finished.','Joynexa',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    } catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Joynexa error',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    } finally { $apply.Enabled = $true }
})
& $refreshHardware
[void]$form.ShowDialog()
