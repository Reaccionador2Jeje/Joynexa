# Developing Joynexa Windows from Debian

The Joynexa Windows repository can be maintained from Debian GNU/Linux even when the reference laptop is not running Windows. Linux is the development host; it does not replace Windows compatibility testing.

## Maintainer host

- Debian 13 (Trixie) or compatible Debian-based distribution.
- Bash for the read-only host audit.
- Python 3 for repository validation.
- Git for source control.

## Prepare the host

Install the basic tools:

\`\`\`bash
sudo apt update
sudo apt install git python3 util-linux pciutils
\`\`\`

Clone the repository:

\`\`\`bash
git clone https://github.com/Reaccionador2Jeje/Joynexa.git
cd Joynexa
\`\`\`

Run the read-only hardware inventory:

\`\`\`bash
bash tools/linux/joynexa-audit.sh
\`\`\`

The audit does not require root. It reports OS, CPU, memory, storage model/capacity, selected PCI devices, firmware, boot mode, and Secure Boot state when available. It intentionally omits disk serial numbers, network MAC addresses, mount paths, and automatic uploads.

Review the report before sharing it. Hardware details help identify the exact ThinkPad Edge E430 configuration, but no report is uploaded automatically.

## What Debian can and cannot validate

Debian can validate repository metadata, shell scripts, documentation, and build tooling. It can also host virtual machines where appropriate.

A Linux host cannot prove that a Windows profile works. The PowerShell profile in \`tools/windows\` must be syntax-checked and tested on a compatible Windows installation before release. Windows-specific behavior, drivers, recovery, and performance must be verified on real supported hardware or a suitable Windows test environment.

## Safe development rules

- Keep Windows Update, Defender, Firewall, UAC, recovery, and essential drivers enabled.
- Do not distribute modified Windows installation images without a documented, lawful process.
- Do not run Windows registry scripts on Linux; they are for Windows PowerShell only.
- Keep audits local unless the maintainer deliberately chooses what to share.
- Never publish a compatibility claim or performance number without repeatable tests.
