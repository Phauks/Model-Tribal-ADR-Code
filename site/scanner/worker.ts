/**
 * The scanner Worker, model-tribal-adr-code-scanner (site/SCANNING.md). It
 * scans files in the private bucket for viruses and malware and writes the
 * results to the file_scans table, which the website reads before serving a
 * file. It has no public address and the website has no binding to it: the
 * table is the only link, so the website runs, and holds files, whether or
 * not this Worker is deployed.
 *
 * Two Durable Objects live here:
 * - ScanEngine, a Cloudflare Container running the scan engine
 *   (engine/: ClamAV, YARA rules and structural checks). It has no internet
 *   access and sleeps after ten idle minutes.
 * - ScanDesk, which works through the waiting files
 *   (src/lib/server/scanning/scan-desk.ts).
 *
 * Adapted, with Trevor Goldsmith's permission as its owner, from
 * apps/scan-worker in his Magna Carta repository.
 */
import { Container, getContainer } from '@cloudflare/containers';
import { DurableObject } from 'cloudflare:workers';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { chooseProvider, type ProviderSettings } from '../src/lib/server/scanning/providers.ts';
import { DeskObject, defaultSizeLimitBytes, type DeskSetup } from '../src/lib/server/scanning/scan-desk.ts';

interface ScannerEnvironment extends ProviderSettings {
	database: D1Database;
	sourceDocuments: R2Bucket;
	/** The project inbox's bucket: mail and its attachments (site/MAIL.md, "Storage"). */
	mailFiles: R2Bucket;
	scanEngine: DurableObjectNamespace<ScanEngine>;
	scanDesk: DurableObjectNamespace<ScanDesk>;
	/** The largest file sent to the engine, in megabytes. Larger files are held as "could not be checked". */
	SCAN_SIZE_LIMIT_MB?: string;
	/** Optional secret: a Workers Builds deploy hook that rebuilds this Worker, and so refreshes ClamAV's signatures. */
	SCAN_REBUILD_HOOK_URL?: string;
}

/** The scan engine Container: clamd plus the scan service on port 8080. */
export class ScanEngine extends Container<ScannerEnvironment> {
	override defaultPort = 8080;
	override requiredPorts = [8080];
	// Loading ClamAV's signatures takes about a minute, so the engine stays up
	// a while after its last scan; it costs nothing once asleep.
	override sleepAfter = '10m';
	// It reads untrusted files, so it never reaches the internet.
	override enableInternet = false;
	override pingEndpoint = 'ready';
}

/** How long to wait for a sleeping engine to load its signatures and listen. */
const engineStartTimeoutMs = 4 * 60 * 1000;

function sizeLimitBytes(setting: string | undefined): number {
	const megabytes = Number(setting);
	return Number.isFinite(megabytes) && megabytes > 0 ? Math.floor(megabytes * 1024 * 1024) : defaultSizeLimitBytes;
}

function deskSetup(environment: ScannerEnvironment): DeskSetup {
	// One engine instance: the desk scans one file at a time.
	const engine = getContainer(environment.scanEngine, 'engine');
	return {
		database: environment.database,
		bucket: environment.sourceDocuments,
		mailBucket: environment.mailFiles,
		sizeLimitBytes: sizeLimitBytes(environment.SCAN_SIZE_LIMIT_MB),
		provider: chooseProvider(environment, {
			fetcher: engine,
			wake: () => engine.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: engineStartTimeoutMs } })
		})
	};
}

/** The desk that works through waiting files. */
export class ScanDesk extends DurableObject<ScannerEnvironment> {
	private readonly desk: DeskObject;

	constructor(context: DurableObjectState, environment: ScannerEnvironment) {
		super(context, environment);
		this.desk = new DeskObject(context, () => deskSetup(environment));
	}

	override fetch(): Promise<Response> {
		return this.desk.fetch();
	}

	override alarm(): Promise<void> {
		return this.desk.alarm();
	}
}

/** Every minute: wake the desk. Once a day at 06:23 UTC: rebuild, for fresh ClamAV signatures, if a deploy hook is set. */
const rebuildCron = '23 6 * * *';

export default {
	async fetch(): Promise<Response> {
		return new Response('Nothing is served here. The website reads scan results from its database.', {
			status: 404,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	},

	async scheduled(controller: ScheduledController, environment: ScannerEnvironment, context: ExecutionContext): Promise<void> {
		if (controller.cron === rebuildCron) {
			if (!environment.SCAN_REBUILD_HOOK_URL) return;
			const response = await fetch(environment.SCAN_REBUILD_HOOK_URL, { method: 'POST' });
			if (!response.ok) throw new Error(`The rebuild hook answered with status ${response.status}.`);
			return;
		}
		const desk = environment.scanDesk.get(environment.scanDesk.idFromName('desk'));
		context.waitUntil(desk.fetch('https://desk/wake', { method: 'POST' }).then((response) => response.body?.cancel()));
	}
} satisfies ExportedHandler<ScannerEnvironment>;
