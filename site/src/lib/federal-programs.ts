/**
 * The federal self-governance, self-determination and block grant programs a
 * nation page can list (`federal_programs` in schemas/tribe.schema.json;
 * research/analyses/2026-11-26-self-governance-programs.md). Trevor asked on
 * Nov. 26, 2026 for the programs on each nation's page ("get it in there"),
 * each linked to a page about the program. Every program here has its law,
 * its rules and the agency's own page; the participant lists behind the facts
 * are cited on each nation page.
 */

export interface FederalProgram {
	/** The `program` value in nation records, and the address segment of its page. */
	key: string;
	/** One agreement, as a row of the nation page's table: "Interior self-governance compact". */
	name: string;
	/** The page title, plural: "Interior self-governance compacts". */
	title: string;
	/** The agency a nation's fact names when it names none. */
	agency: string;
	department: string;
	law: { text: string; link: string };
	rules?: { text: string; link: string };
	/** The agency's own page about the program, or its list of participants. */
	official: { text: string; link: string };
	/** What the nation takes over, one or two sentences. */
	lead: string;
	/** Self-governance compacts are named in At a glance by the department's short name. */
	glance?: string;
}

const uscode = (title: number, section: string) => `https://www.govinfo.gov/link/uscode/${title}/${section}`;

/** In the order the nation page's table lists them: self-governance first, block grants last. */
export const federalPrograms: FederalProgram[] = [
	{
		key: 'interior-self-governance-compact',
		name: 'Interior self-governance compact',
		title: 'Interior self-governance compacts',
		agency: 'Office of Self-Governance, Interior',
		department: 'U.S. Department of the Interior',
		law: { text: 'Indian Self-Determination and Education Assistance Act, title IV, 25 U.S.C. §§ 5361 et seq.', link: uscode(25, '5361') },
		rules: { text: '25 C.F.R. pt. 1000', link: 'https://www.ecfr.gov/current/title-25/chapter-VI/part-1000' },
		official: { text: 'Office of Self-Governance', link: 'https://www.bia.gov/as-ia/osg' },
		lead: 'A compacting nation signs one compact with the Department of the Interior and runs Bureau of Indian Affairs programs as a block, under annual funding agreements, with the freedom to redesign them and move funds between them.',
		glance: 'Interior'
	},
	{
		key: 'indian-health-service-self-governance-compact',
		name: 'Indian Health Service self-governance compact',
		title: 'Indian Health Service self-governance compacts',
		agency: 'Office of Tribal Self-Governance, Indian Health Service',
		department: 'U.S. Department of Health and Human Services',
		law: { text: 'Indian Self-Determination and Education Assistance Act, title V, 25 U.S.C. §§ 5381 et seq.', link: uscode(25, '5381') },
		rules: { text: '42 C.F.R. pt. 137', link: 'https://www.ecfr.gov/current/title-42/chapter-I/subchapter-M/part-137' },
		official: { text: 'Self-Governance Tribes', link: 'https://www.ihs.gov/selfgovernance/tribes/' },
		lead: 'A compacting nation or Tribal organization runs its share of Indian Health Service programs, including Area and headquarters functions, under a compact and funding agreements with the Service.',
		glance: 'Indian Health Service'
	},
	{
		key: 'tribal-transportation-self-governance-compact',
		name: 'Transportation self-governance compact',
		title: 'Transportation self-governance compacts',
		agency: 'Department of Transportation',
		department: 'U.S. Department of Transportation',
		law: { text: '23 U.S.C. § 207', link: uscode(23, '207') },
		rules: { text: '49 C.F.R. pt. 29', link: 'https://www.ecfr.gov/current/title-49/subtitle-A/part-29' },
		official: { text: 'Tribal Transportation Self-Governance Program', link: 'https://www.transportation.gov/self-governance' },
		lead: 'A nation runs its Department of Transportation programs under a compact, on the terms of the self-governance compacts at Interior.',
		glance: 'Transportation'
	},
	{
		key: 'pl-102-477-plan',
		name: '477 plan',
		title: '477 plans',
		agency: 'Bureau of Indian Affairs',
		department: 'U.S. Department of the Interior',
		law: { text: 'Indian Employment, Training and Related Services Act, 25 U.S.C. §§ 3401-3417', link: uscode(25, '3401') },
		official: { text: '477 Plan Directory', link: 'https://www.bia.gov/bia/ois/dwd/477Initiative/477PlanDirectory' },
		lead: 'A nation merges funds from several federal employment, training and related programs, from up to 12 departments, into one plan with one budget and one report. Interior approves the plans.'
	},
	{
		key: 'fdpir-self-determination-demonstration',
		name: 'FDPIR self-determination project',
		title: 'FDPIR self-determination projects',
		agency: 'Food and Nutrition Service',
		department: 'U.S. Department of Agriculture',
		law: { text: 'Agriculture Improvement Act of 2018, Pub. L. No. 115-334, § 4003(b)', link: 'https://www.govinfo.gov/link/plaw/115/public/334?link-type=html' },
		rules: { text: '7 C.F.R. pt. 253', link: 'https://www.ecfr.gov/current/title-7/subtitle-B/chapter-II/subchapter-C/part-253' },
		official: { text: 'FDPIR Self-Determination Demonstration Projects', link: 'https://www.fns.usda.gov/fdpir/self-determination' },
		lead: 'A Tribal organization that runs the Food Distribution Program on Indian Reservations buys some of the foods in its package itself, under a 638 contract with the Food and Nutrition Service.'
	},
	{
		key: 'interior-non-bia-funding-agreement',
		name: 'Interior funding agreement',
		title: 'Interior funding agreements outside the Bureau of Indian Affairs',
		agency: 'Department of the Interior',
		department: 'U.S. Department of the Interior',
		law: { text: '25 U.S.C. § 5363(c)', link: uscode(25, '5363') },
		rules: { text: '25 C.F.R. pt. 1000', link: 'https://www.ecfr.gov/current/title-25/chapter-VI/part-1000' },
		official: { text: 'Office of Self-Governance', link: 'https://www.bia.gov/as-ia/osg' },
		lead: 'A self-governance nation may also run programs of other Interior bureaus, such as the National Park Service or the Bureau of Reclamation, under a funding agreement with that bureau. Interior lists the agreements each year in the Federal Register.'
	},
	{
		key: 'isdeaa-contract-interior',
		name: 'Self-determination contract with Interior',
		title: 'Self-determination contracts with Interior',
		agency: 'Bureau of Indian Affairs',
		department: 'U.S. Department of the Interior',
		law: { text: 'Indian Self-Determination and Education Assistance Act, title I, 25 U.S.C. §§ 5321 et seq.', link: uscode(25, '5321') },
		rules: { text: '25 C.F.R. pt. 900', link: 'https://www.ecfr.gov/current/title-25/chapter-V/part-900' },
		official: { text: 'Office of Indian Services', link: 'https://www.bia.gov/bia/ois' },
		lead: 'A nation or Tribal organization runs one Interior program at a time, such as law enforcement or roads, under a contract the agency must award if the proposal meets the law. These are called 638 contracts, after Public Law 93-638.'
	},
	{
		key: 'isdeaa-contract-indian-health-service',
		name: 'Self-determination contract with the Indian Health Service',
		title: 'Self-determination contracts with the Indian Health Service',
		agency: 'Indian Health Service',
		department: 'U.S. Department of Health and Human Services',
		law: { text: 'Indian Self-Determination and Education Assistance Act, title I, 25 U.S.C. §§ 5321 et seq.', link: uscode(25, '5321') },
		rules: { text: '25 C.F.R. pt. 900', link: 'https://www.ecfr.gov/current/title-25/chapter-V/part-900' },
		official: { text: 'Office of Direct Service and Contracting Tribes', link: 'https://www.ihs.gov/odsct/' },
		lead: 'A nation or Tribal organization runs one Indian Health Service program at a time, such as a clinic or a dental program, under a 638 contract.'
	},
	{
		key: 'tribally-controlled-school-grant',
		name: 'Tribally controlled school grant',
		title: 'Tribally controlled school grants',
		agency: 'Bureau of Indian Education',
		department: 'U.S. Department of the Interior',
		law: { text: 'Tribally Controlled Schools Act, 25 U.S.C. §§ 2501-2511', link: uscode(25, '2501') },
		rules: { text: '25 C.F.R. pt. 44', link: 'https://www.ecfr.gov/current/title-25/chapter-I/subchapter-E/part-44' },
		official: { text: 'Bureau of Indian Education', link: 'https://www.bie.edu/' },
		lead: 'A nation or Tribal organization runs a Bureau of Indian Education school under one grant that combines the Bureau’s and the Department of Education’s formula funds.'
	},
	{
		key: 'tribal-forest-protection-act-agreement',
		name: 'Tribal Forest Protection Act agreement',
		title: 'Tribal Forest Protection Act agreements',
		agency: 'Forest Service',
		department: 'U.S. Department of Agriculture',
		law: { text: '25 U.S.C. §§ 3115a, 3115b', link: uscode(25, '3115a') },
		official: { text: 'Tribal Forest Protection Act', link: 'https://www.fs.usda.gov/es/node/761889642' },
		lead: 'A nation carries out projects on Forest Service or Bureau of Land Management land next to its own forest land, under an agreement or a 638 contract.'
	},
	{
		key: 'tribal-tanf',
		name: 'Tribal TANF program',
		title: 'Tribal TANF programs',
		agency: 'Office of Family Assistance',
		department: 'U.S. Department of Health and Human Services',
		law: { text: '42 U.S.C. § 612', link: uscode(42, '612') },
		rules: { text: '45 C.F.R. pt. 286', link: 'https://www.ecfr.gov/current/title-45/subtitle-B/chapter-II/part-286' },
		official: { text: 'Tribal TANF', link: 'https://acf.gov/ofa/programs/tribal/tribal-tanf' },
		lead: 'A nation runs its own Temporary Assistance for Needy Families program in place of the state’s, setting its own service area, eligibility, time limits and work rules.'
	},
	{
		key: 'tribal-title-iv-e-plan',
		name: 'Title IV-E plan',
		title: 'Tribal Title IV-E plans',
		agency: 'Children’s Bureau',
		department: 'U.S. Department of Health and Human Services',
		law: { text: '42 U.S.C. § 679c', link: uscode(42, '679c') },
		rules: { text: '45 C.F.R. pt. 1356', link: 'https://www.ecfr.gov/current/title-45/subtitle-B/chapter-XIII/subchapter-G/part-1356' },
		official: { text: 'Children’s Bureau', link: 'https://acf.gov/cb' },
		lead: 'A nation runs its own foster care, adoption and guardianship assistance program in place of the state’s.'
	},
	{
		key: 'indian-housing-block-grant',
		name: 'Indian Housing Block Grant',
		title: 'Indian Housing Block Grants',
		agency: 'Housing and Urban Development',
		department: 'U.S. Department of Housing and Urban Development',
		law: { text: 'Native American Housing Assistance and Self-Determination Act of 1996, 25 U.S.C. §§ 4101 et seq.', link: uscode(25, '4101') },
		rules: { text: '24 C.F.R. pt. 1000', link: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-1000' },
		official: { text: 'Indian Housing Block Grant Program', link: 'https://www.hud.gov/program_offices/public_indian_housing/ih/grants/ihbg' },
		lead: 'A nation, or the housing entity it names, receives its housing funds as a block grant by formula and spends them under its own housing plan.'
	}
];

const byKey = new Map(federalPrograms.map((program) => [program.key, program]));

export function federalProgram(key: string): FederalProgram | undefined {
	return byKey.get(key);
}

export const federalProgramsPath = '/nations/federal-programs';

export function federalProgramPage(key: string): string | undefined {
	return byKey.has(key) ? `${federalProgramsPath}/${key}` : undefined;
}

const months = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** "Oct. 1, 2026", "Aug. 2023" or "2023", for a date given as YYYY-MM-DD, YYYY-MM or YYYY. */
export function shortDate(date: string): string {
	const [year, month, day] = date.split('-');
	if (!month) return year;
	const name = months[Number(month) - 1];
	return day ? `${name} ${Number(day)}, ${year}` : `${name} ${year}`;
}

/** "$151.6 million (2025)", "$812,000 (2026)". */
export function amountText(amount: number, fiscalYear?: number): string {
	const words =
		amount >= 1_000_000_000
			? `$${(amount / 1_000_000_000).toFixed(1)} billion`
			: amount >= 1_000_000
				? `$${(amount / 1_000_000).toFixed(1)} million`
				: `$${Math.round(amount).toLocaleString('en-US')}`;
	return fiscalYear ? `${words} (${fiscalYear})` : words;
}
