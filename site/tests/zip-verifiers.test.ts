import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, appendFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifierReadme, verifyPowerShell, verifyShell } from '#lib/zip-verifiers.ts';

const folders: string[] = [];
afterEach(() => {
	for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** An unpacked ZIP: one document, SHA256SUMS.txt as the ZIPs write it, and verify.sh. */
function unpacked(): string {
	const folder = mkdtempSync(join(tmpdir(), 'zip-verifiers-'));
	folders.push(folder);
	mkdirSync(join(folder, 'documents'));
	const bytes = Buffer.from('%PDF-1.4 a document');
	writeFileSync(join(folder, 'documents', 'one file.pdf'), bytes);
	writeFileSync(join(folder, 'SHA256SUMS.txt'), `${createHash('sha256').update(bytes).digest('hex')}  documents/one file.pdf\n`);
	writeFileSync(join(folder, 'verify.sh'), verifyShell);
	return folder;
}

function run(folder: string): { status: number; output: string } {
	try {
		const output = execFileSync('sh', [join(folder, 'verify.sh')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
		return { status: 0, output };
	} catch (error) {
		const failure = error as { status: number; stdout: string; stderr: string };
		return { status: failure.status, output: `${failure.stdout}${failure.stderr}` };
	}
}

describe('the scripts that check a ZIP download', () => {
	it('verify.sh passes untouched files and fails a changed one', () => {
		const folder = unpacked();
		const passed = run(folder);
		expect(passed.status).toBe(0);
		expect(passed.output).toContain('documents/one file.pdf: OK');
		appendFileSync(join(folder, 'documents', 'one file.pdf'), 'x');
		const failed = run(folder);
		expect(failed.status).not.toBe(0);
		expect(failed.output).toContain('FAILED');
	});

	it('are plain ASCII with the line endings each system expects', () => {
		expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(verifyShell)).toBe(true);
		expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(verifyPowerShell)).toBe(true);
		expect(verifyShell).not.toContain('\r');
		expect(verifyPowerShell.split('\n').every((line, index, lines) => index === lines.length - 1 || line.endsWith('\r'))).toBe(true);
	});

	it('tell the reader where Verify File is', () => {
		expect(verifierReadme('https://example.org/verify')).toContain('Verify File at https://example.org/verify.');
	});
});
