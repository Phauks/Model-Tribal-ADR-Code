/**
 * Orders by account, problems buyers report, and refunds (docs/book-orders.md,
 * "Your orders and problems"; migrations/20261123T1820_add_book_order_problems_and_refunds.sql).
 *
 * A photo sent with a problem came from outside the project, so it is stored
 * with storeSentFile and opened only with openScannedFile (site/SCANNING.md).
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { longestProblemText, openProblemsPerOrder, type ProblemKind, type ProblemStatus } from '#lib/book-order-problems.ts';
import type { PrintChoice } from '#lib/book-order.ts';
import { bookLine, statusOfBookOrder, type OrderSummary, type WorkspaceOrder } from '#lib/orders.ts';
import { openScannedFile, storeSentFile, type OpenedFile } from './file-scans.ts';
import { newIdentifier } from './identifiers.ts';
import type { UploadedFile } from './request-form.ts';

interface SummaryRow {
	identifier: string;
	mode: 'test' | 'live';
	status: string;
	choice: string;
	page_count: number;
	print_job: number | null;
	printer_status: string | null;
	price_cents: number;
	gift_cents: number;
	refunded_cents: number;
	refunded_at: string | null;
	tracking_link: string | null;
	created_at: string;
	open_problems: number;
}

/** A printed-copy order as the general orders lists show it (src/lib/orders.ts). */
function summaryFromRow(row: SummaryRow): OrderSummary {
	return {
		identifier: row.identifier,
		mode: row.mode,
		status: statusOfBookOrder(row.status),
		lines: [bookLine(JSON.parse(row.choice) as PrintChoice, row.page_count, row.print_job, row.printer_status)],
		priceCents: row.price_cents,
		giftCents: row.gift_cents,
		refundedCents: row.refunded_cents,
		refundedAt: row.refunded_at,
		trackingLink: row.tracking_link,
		placedAt: row.created_at,
		openProblems: row.open_problems
	};
}

const summaryColumns = `o.identifier, o.mode, o.status, o.choice, o.page_count, o.print_job, o.printer_status, o.price_cents, o.gift_cents,
	o.refunded_cents, o.refunded_at, o.tracking_link, o.created_at,
	(SELECT count(*) FROM book_order_problems p WHERE p.order_identifier = o.identifier AND p.status = 'open') AS open_problems`;

/**
 * The orders an account placed while signed in, newest first. Orders that
 * were never paid for are left out, since nothing happened to them.
 */
export async function ordersOfAccount(database: D1Database, account: string): Promise<OrderSummary[]> {
	const { results } = await database
		.prepare(
			`SELECT ${summaryColumns} FROM book_orders o
			WHERE o.account_identifier = ? AND o.status NOT IN ('awaiting-payment', 'expired')
			ORDER BY o.created_at DESC LIMIT 200`
		)
		.bind(account)
		.all<SummaryRow>();
	return results.map(summaryFromRow);
}

/** Every order, newest first, for the workspace's Orders page, with who it goes to and its Stripe payment. */
export async function allOrders(database: D1Database, limit = 300): Promise<WorkspaceOrder[]> {
	const { results } = await database
		.prepare(
			`SELECT ${summaryColumns}, o.recipient_name, o.email, o.payment_session, o.printer_message
			FROM book_orders o ORDER BY o.created_at DESC LIMIT ?`
		)
		.bind(limit)
		.all<SummaryRow & { recipient_name: string | null; email: string | null; payment_session: string | null; printer_message: string | null }>();
	return results.map((row) => ({
		...summaryFromRow(row),
		recipientName: row.recipient_name,
		email: row.email,
		paymentSession: row.payment_session,
		makerMessage: row.printer_message
	}));
}

export interface OrderProblem {
	identifier: string;
	orderIdentifier: string;
	kind: ProblemKind;
	details: string;
	hasPhoto: boolean;
	status: ProblemStatus;
	answer: string | null;
	reportedAt: string;
	updatedAt: string;
}

interface ProblemRow {
	identifier: string;
	order_identifier: string;
	kind: ProblemKind;
	details: string;
	photo_key: string | null;
	photo_type: string | null;
	status: ProblemStatus;
	answer: string | null;
	created_at: string;
	updated_at: string;
}

function problemFromRow(row: ProblemRow): OrderProblem {
	return {
		identifier: row.identifier,
		orderIdentifier: row.order_identifier,
		kind: row.kind,
		details: row.details,
		hasPhoto: Boolean(row.photo_key),
		status: row.status,
		answer: row.answer,
		reportedAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export async function problemsOfOrder(database: D1Database, order: string): Promise<OrderProblem[]> {
	const { results } = await database
		.prepare('SELECT * FROM book_order_problems WHERE order_identifier = ? ORDER BY created_at DESC')
		.bind(order)
		.all<ProblemRow>();
	return results.map(problemFromRow);
}

/** Problems still to deal with (open first, then answered), oldest first, for the workspace. */
export async function unsettledProblems(database: D1Database): Promise<OrderProblem[]> {
	const { results } = await database
		.prepare(
			`SELECT * FROM book_order_problems WHERE status <> 'closed'
			ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, created_at LIMIT 300`
		)
		.all<ProblemRow>();
	return results.map(problemFromRow);
}

export async function openProblemCount(database: D1Database): Promise<number> {
	const row = await database.prepare(`SELECT count(*) AS count FROM book_order_problems WHERE status = 'open'`).first<{ count: number }>();
	return row?.count ?? 0;
}

export interface NewProblem {
	kind: ProblemKind;
	details: string;
	photo: UploadedFile | null;
}

/**
 * Saves a problem a buyer reports. Refuses when the order already has
 * several open problems, so a leaked link cannot flood the project.
 */
export async function reportProblem(
	database: D1Database,
	bucket: R2Bucket,
	order: string,
	problem: NewProblem,
	now: string
): Promise<{ saved: true; identifier: string } | { saved: false; reason: string }> {
	if (problem.details.length === 0 || problem.details.length > longestProblemText) {
		return { saved: false, reason: 'Say what happened, in under 4,000 characters.' };
	}
	const open = await database
		.prepare(`SELECT count(*) AS count FROM book_order_problems WHERE order_identifier = ? AND status = 'open'`)
		.bind(order)
		.first<{ count: number }>();
	if ((open?.count ?? 0) >= openProblemsPerOrder) {
		return { saved: false, reason: 'This order already has several problems waiting for an answer. The project will reply to those first.' };
	}

	const identifier = newIdentifier();
	await database
		.prepare(
			`INSERT INTO book_order_problems (identifier, order_identifier, kind, details, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, 'open', ?, ?)`
		)
		.bind(identifier, order, problem.kind, problem.details, now, now)
		.run();
	if (problem.photo) {
		const photoKey = `book-orders/${order}/${identifier}`;
		// Held until the virus check passes (site/SCANNING.md). If it cannot be
		// put in line, storeSentFile deletes it again and the problem stays,
		// without the photo.
		await storeSentFile(database, bucket, {
			objectKey: photoKey,
			purpose: 'book-order-photo',
			subject: order,
			bytes: problem.photo.bytes,
			httpMetadata: { contentType: problem.photo.type },
			customMetadata: { order, fileName: problem.photo.name }
		});
		await database
			.prepare('UPDATE book_order_problems SET photo_key = ?, photo_type = ? WHERE identifier = ?')
			.bind(photoKey, problem.photo.type, identifier)
			.run();
	}
	return { saved: true, identifier };
}

/** Writes the project's answer, shown on the order's page, and marks the problem answered or closed. */
export async function answerProblem(
	database: D1Database,
	problem: string,
	answer: string | null,
	status: Exclude<ProblemStatus, 'open'>,
	now: string
): Promise<boolean> {
	if (answer !== null && answer.length > longestProblemText) return false;
	const result = await database
		.prepare('UPDATE book_order_problems SET answer = coalesce(?, answer), status = ?, updated_at = ? WHERE identifier = ?')
		.bind(answer, status, now, problem)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** Opens a problem's photo through the scan door, with its type. */
export async function openProblemPhoto(
	database: D1Database,
	bucket: R2Bucket,
	problem: string
): Promise<{ opened: OpenedFile; type: string } | null> {
	const row = await database
		.prepare('SELECT photo_key, photo_type FROM book_order_problems WHERE identifier = ?')
		.bind(problem)
		.first<{ photo_key: string | null; photo_type: string | null }>();
	if (!row?.photo_key || !row.photo_type) return null;
	return { opened: await openScannedFile(database, bucket, row.photo_key), type: row.photo_type };
}

/**
 * Records a refund made in Stripe's dashboard, so the order's page says so.
 * The amount is the total refunded so far, up to what the buyer paid,
 * the gift included.
 */
export async function recordRefund(database: D1Database, order: string, refundedCents: number, now: string): Promise<boolean> {
	const result = await database
		.prepare(
			`UPDATE book_orders SET refunded_cents = ?, refunded_at = CASE WHEN ? > 0 THEN ? ELSE NULL END, updated_at = ?
			WHERE identifier = ? AND ? BETWEEN 0 AND price_cents + gift_cents`
		)
		.bind(refundedCents, refundedCents, now, now, order, refundedCents)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}
