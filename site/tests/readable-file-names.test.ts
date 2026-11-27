import { describe, expect, it } from 'vitest';
import { contentDisposition, readableFileName, readableFileNames, safeFileText } from '../src/lib/readable-file-names.ts';

describe('readable names for downloaded copies', () => {
	it('names a copy by its title, adding the nation when the title does not name it', () => {
		expect(readableFileName({ key: 'tribal-law/documents/6df61ccdf0a3cbf733b3.pdf', title: 'Peacemaker Court', nations: ['Alabama-Coushatta Tribe of Texas'] })).toBe(
			'Peacemaker Court - Alabama-Coushatta Tribe of Texas.pdf'
		);
		expect(readableFileName({ key: 'govinfo/STATUTE-100/STATUTE-100-Pg849.pdf', title: '100 Stat. 849', nations: ['Klamath Tribes'] })).toBe('100 Stat. 849 - Klamath Tribes.pdf');
		expect(
			readableFileName({ key: 'constitutions/native-village-of-buckland/000a1f3cef5b838c.pdf', title: 'Constitution and By-laws of the Native Village of Buckland, Alaska', nations: ['Native Village of Buckland'] })
		).toBe('Constitution and By-laws of the Native Village of Buckland, Alaska.pdf');
		expect(readableFileName({ key: 'nigc/enforcement-actions/NOV-09-29a.pdf', title: 'Notice of violation NOV-09-29: Crow Tribe', nations: ['Crow Tribe of Montana'] })).toBe(
			'Notice of violation NOV-09-29 - Crow Tribe.pdf'
		);
	});

	it('takes the published file name for a copy with no title', () => {
		expect(
			readableFileName({
				key: 'tribal-law/documents/0106465e462987db7d9b.pdf',
				title: 'tribal-law/documents/0106465e462987db7d9b.pdf',
				links: ['https://ho-chunknation.com/wp-content/uploads/2026/06/2HCC6-Election-Code.clean-06.09.26.pdf'],
				nations: ['Ho-Chunk Nation of Wisconsin']
			})
		).toBe('2HCC6-Election-Code.clean-06.09.26 - Ho-Chunk Nation of Wisconsin.pdf');
	});

	it('sets a title written in capitals in title case, keeping Roman numerals', () => {
		expect(readableFileName({ key: 'constitutions/a/b.pdf', title: 'CONSTITUTION AND BY-LAWS, ARTICLE IV' })).toBe('Constitution and By-Laws, Article IV.pdf');
	});

	it('leaves out what a file system refuses and keeps names short', () => {
		expect(safeFileText('Gabrielino/Tongva: "the" Nation? <draft>.')).toBe("Gabrielino-Tongva - 'the' Nation draft");
		const long = readableFileName({ key: 'congress/CRPT-108hrpt792.pdf', title: `Making Appropriations ${'for Foreign Operations '.repeat(10)}(and so on)` });
		expect(long.length).toBeLessThanOrEqual(120);
		expect(long.endsWith('Operations.pdf')).toBe(true);
	});

	it('tells copies of the same title apart by the code in their keys', () => {
		const names = readableFileNames([
			{ key: 'govinfo/FR-1996-02-06/96-2450.pdf', title: 'Indian Gaming' },
			{ key: 'govinfo/FR-1996-09-04/96-22437.pdf', title: 'Indian Gaming' },
			{ key: 'caselaw-access-project/cal-app-3d/202/0835-01.html', title: 'People v. Williams' },
			{ key: 'caselaw-access-project/p2d/10/0100-01.html', title: 'People v. Williams' },
			{ key: 'constitutions/a/0beadc25bd6b9e57.pdf', title: 'Constitution' },
			{ key: 'constitutions/a/1beadc25bd6b9e57.pdf', title: 'Constitution' },
			{ key: 'treaties/treaty-with-the-sioux-1825.pdf', title: 'Treaty with the Sioux, 1825' }
		]);
		expect(names.get('govinfo/FR-1996-02-06/96-2450.pdf')).toBe('Indian Gaming (96-2450).pdf');
		expect(names.get('govinfo/FR-1996-09-04/96-22437.pdf')).toBe('Indian Gaming (96-22437).pdf');
		expect(names.get('caselaw-access-project/cal-app-3d/202/0835-01.html')).toBe('People v. Williams (cal-app-3d 202 0835-01).html');
		expect(names.get('constitutions/a/0beadc25bd6b9e57.pdf')).toBe('Constitution (0beadc25).pdf');
		expect(names.get('treaties/treaty-with-the-sioux-1825.pdf')).toBe('Treaty with the Sioux, 1825.pdf');
		expect(new Set([...names.values()].map((name) => name.toLowerCase())).size).toBe(names.size);
	});

	it('writes a Content-Disposition header with a plain name and the full one', () => {
		expect(contentDisposition('Treaty with the Sioux, 1825.pdf', 'inline')).toBe('inline; filename="Treaty with the Sioux, 1825.pdf"');
		expect(contentDisposition('Diné Bi Beenahazáanii (§ 1).pdf')).toBe(
			`attachment; filename="Dine Bi Beenahazaanii (_ 1).pdf"; filename*=UTF-8''Din%C3%A9%20Bi%20Beenahaz%C3%A1anii%20%28%C2%A7%201%29.pdf`
		);
	});
});
