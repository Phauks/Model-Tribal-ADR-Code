/**
 * The scripts every ZIP download carries beside SHA256SUMS.txt, so a reader can check all its
 * files in one step without the website (Trevor asked on Nov. 27, 2026). verify.sh runs on a Mac
 * or Linux, verify.ps1 on Windows. Both only read the files named in SHA256SUMS.txt and compare
 * each one's SHA-256 with the listed value; they change nothing and send nothing anywhere.
 *
 * The scripts are not listed in SHA256SUMS.txt: a script cannot vouch for itself. They are plain
 * ASCII, so Windows PowerShell 5.1 reads verify.ps1 correctly without a byte order mark.
 */

export const verifyShellName = 'verify.sh';
export const verifyPowerShellName = 'verify.ps1';
export const verifierNames: readonly string[] = [verifyShellName, verifyPowerShellName];

/** For a Mac or Linux: sh verify.sh, from the unpacked folder. Lines end with a line feed. */
export const verifyShell = `${[
	'#!/bin/sh',
	'# Checks every file named in SHA256SUMS.txt against the SHA-256 the Tribal Law',
	'# Project website published for it. Run it from the unpacked folder:',
	'#   sh verify.sh',
	'# It only reads files; it changes nothing and sends nothing anywhere.',
	'cd "$(dirname "$0")" || exit 2',
	'if command -v sha256sum >/dev/null 2>&1; then',
	'\tsha256sum -c SHA256SUMS.txt',
	'elif command -v shasum >/dev/null 2>&1; then',
	'\tshasum -a 256 -c SHA256SUMS.txt',
	'else',
	'\techo "No SHA-256 tool was found. Use Verify File on the website instead." >&2',
	'\texit 2',
	'fi',
	'status=$?',
	'if [ "$status" -eq 0 ]; then',
	'\techo "All files match what the website published."',
	'else',
	'\techo "Some files do not match. Download them again, or check them on Verify File." >&2',
	'fi',
	'exit "$status"'
].join('\n')}\n`;

/** For Windows: right-click, Run with PowerShell. Lines end with a carriage return and line feed. */
export const verifyPowerShell = `${[
	'# Checks every file named in SHA256SUMS.txt against the SHA-256 the Tribal Law',
	'# Project website published for it. Right-click this file and choose',
	'# "Run with PowerShell", or run: powershell -ExecutionPolicy Bypass -File verify.ps1',
	'# It only reads files; it changes nothing and sends nothing anywhere.',
	'Set-Location -LiteralPath $PSScriptRoot',
	'$bad = 0',
	"foreach ($line in Get-Content -LiteralPath 'SHA256SUMS.txt' -Encoding UTF8) {",
	"\tif ($line -notmatch '^([0-9a-fA-F]{64}) [ *](.+)$') { continue }",
	'\t$expected = $Matches[1].ToLowerInvariant()',
	'\t$name = $Matches[2]',
	'\tif (-not (Test-Path -LiteralPath $name -PathType Leaf)) { Write-Host "${name}: MISSING"; $bad++; continue }',
	'\t$actual = (Get-FileHash -LiteralPath $name -Algorithm SHA256).Hash.ToLowerInvariant()',
	'\tif ($actual -eq $expected) { Write-Host "${name}: OK" } else { Write-Host "${name}: FAILED"; $bad++ }',
	'}',
	'if ($bad -eq 0) { Write-Host \'All files match what the website published.\' } else { Write-Host "$bad file(s) do not match. Download them again, or check them on Verify File." }',
	"if ($Host.Name -eq 'ConsoleHost') { [void](Read-Host 'Press Enter to close') }",
	'exit [int]($bad -gt 0)'
].join('\r\n')}\r\n`;

/** The README paragraph that tells a reader how to run them; verifyAddress is where Verify File is, such as https://triballawproject.org/verify. */
export function verifierReadme(verifyAddress: string): string {
	return `To check every file at once, run verify.sh on a Mac or Linux (sh verify.sh in this folder) or verify.ps1 on Windows (right-click it, then Run with PowerShell). Each compares the files with SHA256SUMS.txt and says OK or FAILED for each one; it only reads the files and sends nothing anywhere. If you would rather not run a script, choose the files on Verify File at ${verifyAddress}.`;
}
