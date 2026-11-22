import { describe, expect, it } from 'vitest';
import {
	fingerprintOf,
	pageChange,
	shownText,
	startNameOf,
	withBuild,
	withoutBuild,
	type Fingerprints
} from '#lib/offline-fingerprints.ts';
import {
	fingerprintOf as toolFingerprintOf,
	shownText as toolShownText,
	startNameOf as toolStartNameOf,
	withoutBuild as toolWithoutBuild
} from '../tools/write-offline-sizes.mjs';

/** A built page, shaped like the ones SvelteKit writes: only the build and the script names differ between builds. */
function builtPage(build: { version: string; startName: string; script: string }, body: string): string {
	return [
		'<!doctype html><html lang="en"><head>',
		`<link rel="modulepreload" href="/_app/immutable/entry/${build.script}.js">`,
		`</head><body><main>${body}</main><script>`,
		`${build.startName} = {`,
		`base: "", version: "${build.version}"`,
		'};',
		`kit.start(app, ${build.startName});`,
		'</script></body></html>'
	].join('\n');
}

const first = { version: '0.0.1+1795338854527', startName: '__sveltekit_jlb1tw', script: 'start.AAA111' };
const second = { version: '0.0.1+1795338887210', startName: '__sveltekit_108r0g9', script: 'start.AAA111' };
const newScripts = { ...second, script: 'start.BBB222' };

describe('offline fingerprints', () => {
	it('match for the same page in two builds, and rebuild the new build’s page exactly', async () => {
		const before = builtPage(first, '<p>Same words</p>');
		const after = builtPage(second, '<p>Same words</p>');
		const blanked = withoutBuild(before, first.version);
		expect(await fingerprintOf(blanked)).toBe(await fingerprintOf(withoutBuild(after, second.version)));
		expect(withBuild(blanked, second.version, second.startName)).toBe(after);
	});

	it('differ when the words on the page change', async () => {
		const before = withoutBuild(builtPage(first, '<p>Old words</p>'), first.version);
		const after = withoutBuild(builtPage(second, '<p>New words</p>'), second.version);
		expect(await fingerprintOf(before)).not.toBe(await fingerprintOf(after));
	});

	it('differ when only the scripts change, but what the page shows does not', async () => {
		const before = withoutBuild(builtPage(first, '<p>Same words</p>'), first.version);
		const after = withoutBuild(builtPage(newScripts, '<p>Same words</p>'), newScripts.version);
		expect(await fingerprintOf(before)).not.toBe(await fingerprintOf(after));
		expect(await fingerprintOf(shownText(before))).toBe(await fingerprintOf(shownText(after)));
	});

	it('are taken the same way by the build tool and the service worker', async () => {
		const page = builtPage(first, '<p>Words with ʻokina and é</p>');
		expect(toolStartNameOf(page)).toBe(startNameOf(page));
		expect(toolWithoutBuild(page, first.version)).toBe(withoutBuild(page, first.version));
		const blanked = withoutBuild(page, first.version);
		expect(toolShownText(blanked)).toBe(shownText(blanked));
		expect(toolFingerprintOf(blanked)).toBe(await fingerprintOf(blanked));
		const data = '{"type":"data","nodes":[]}';
		expect(toolFingerprintOf(Buffer.from(data))).toBe(await fingerprintOf(new TextEncoder().encode(data).buffer));
	});

	it('tell whether an update changes, keeps or removes a page', () => {
		const reading: Fingerprints = {
			version: first.version,
			startName: first.startName,
			files: {},
			pages: { '/a': '1', '/b': '2', '/c': '3' }
		};
		const waiting: Fingerprints = { ...reading, version: second.version, pages: { '/a': '1', '/b': '9' } };
		expect(pageChange('/a', reading, waiting)).toBe('unchanged');
		expect(pageChange('/b', reading, waiting)).toBe('changed');
		expect(pageChange('/c', reading, waiting)).toBe('removed');
		expect(pageChange('/requests', reading, waiting)).toBeUndefined();
	});
});
