#!/usr/bin/env bash
# Joynexa Linux host audit - read-only hardware inventory.
# Does not require root, change settings, or upload device information.
set -Eeuo pipefail
section() { printf '\n=== %s ===\n' "$1"; }
read_file() {
  local file="$1"
  if [[ -r "$file" ]]; then tr -d '\0' < "$file" 2>/dev/null || true
  else printf 'Not available'
  fi
}
section "Joynexa host audit"
printf 'Date (UTC): '
date -u '+%Y-%m-%d %H:%M:%S' 2>/dev/null || printf 'Not available\n'
printf 'Kernel: '
uname -srmo 2>/dev/null || true
section "Operating system"
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  printf 'Distribution: %s\n' "\${PRETTY_NAME:-unknown}"
else printf 'Distribution: unknown\n'; fi
printf 'Architecture: '
uname -m 2>/dev/null || true
section "Processor"
if command -v lscpu >/dev/null 2>&1; then
  lscpu | grep -E '^(Architecture|CPU\(s\)|Model name|Vendor ID|CPU family|Model:|Thread|Core|Socket|Virtualization):' || true
else
  grep -m1 -E '^(vendor_id|model name|cpu family|model)[[:space:]]*:' /proc/cpuinfo 2>/dev/null || true
fi
section "Memory"
if command -v free >/dev/null 2>&1; then free -h
else grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):' /proc/meminfo 2>/dev/null || true; fi
section "Storage devices (no serial numbers or mount paths)"
if command -v lsblk >/dev/null 2>&1; then
  lsblk -d -o NAME,SIZE,TYPE,ROTA,MODEL 2>/dev/null || lsblk -d 2>/dev/null || true
else printf 'lsblk is not installed.\n'; fi
section "Graphics and network hardware"
if command -v lspci >/dev/null 2>&1; then
  lspci -nn 2>/dev/null | grep -Ei 'VGA|3D controller|Display controller|Ethernet controller|Network controller|Wireless' || true
else printf 'lspci is not installed. Install pciutils for PCI device details.\n'; fi
section "Firmware and system board"
while IFS='|' read -r label file; do
  if [[ -r "$file" ]]; then value="$(tr -d '\0' < "$file" 2>/dev/null || true)"
  else value='Not available'; fi
  printf '%s %s\n' "$label" "$value"
done <<'EOF'
System vendor|/sys/class/dmi/id/sys_vendor
System model|/sys/class/dmi/id/product_name
Board vendor|/sys/class/dmi/id/board_vendor
Board name|/sys/class/dmi/id/board_name
BIOS version|/sys/class/dmi/id/bios_version
BIOS date|/sys/class/dmi/id/bios_date
EOF
section "Boot and security information"
if [[ -d /sys/firmware/efi ]]; then printf 'Boot mode: UEFI\n'
else printf 'Boot mode: Legacy BIOS or EFI details unavailable\n'; fi
if command -v mokutil >/dev/null 2>&1; then
  mokutil --sb-state 2>/dev/null || printf 'Secure Boot state unavailable\n'
else printf 'Secure Boot: mokutil not installed (state not checked)\n'; fi
section "Audit complete"
printf '%s\n' 'Read-only report only. Nothing was changed and no data was uploaded.'
printf '%s\n' 'Review this report before sharing it; redact anything you consider private.'
