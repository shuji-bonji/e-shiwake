/**
 * 請求書と仕訳の紐づけの移行（v0.7.0）
 *
 * v0.6.x までは請求書側が `journalId`（売掛金仕訳）と `depositJournalIds`（入金仕訳）を持ち、
 * ステータスに `'paid'`（入金済み）があった。v0.7.0 からは仕訳側の `invoiceId` で紐づけ、
 * 入金状態は仕訳から導出する。ここでは旧形式の請求書を新形式に写す。
 *
 * Dexie の version(10) の upgrade と、旧形式 JSON / ZIP のインポートの両方から使う。
 */

import type { Table } from 'dexie';
import type { Invoice, InvoiceStatus } from '$lib/types/invoice';
import type { JournalEntry } from '$lib/types';

/** 仕訳テーブル（Dexie の EntityTable と upgrade の tx.table() の両方を受ける） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JournalTable = Table<JournalEntry, string, any>;

/** 旧形式（v0.6.x 以前）の請求書。新形式の請求書もそのまま渡せる */
export type LegacyInvoice = Omit<Invoice, 'status'> & {
	status: InvoiceStatus | 'paid';
	journalId?: string;
	depositJournalIds?: string[];
};

/** 請求書 1 件を新形式に写した結果 */
export interface NormalizedInvoice {
	/** 新形式の請求書（`journalId` / `depositJournalIds` を含まない） */
	invoice: Invoice;
	/** 仕訳側に書き込むべき紐づけ */
	links: InvoiceJournalLink[];
}

/** 仕訳側に書き込む紐づけ 1 件 */
export interface InvoiceJournalLink {
	journalId: string;
	invoiceId: string;
	/** 請求書の「売掛金仕訳」ボタンが生成した仕訳なら 'invoice' */
	generatedFrom?: 'invoice';
}

/**
 * 旧形式の請求書を新形式に写す（純粋関数）
 *
 * - `status === 'paid'` → `status = 'issued'`、`settledManually = true`
 * - `journalId` → 仕訳側へ `invoiceId` + `generatedFrom: 'invoice'`
 * - `depositJournalIds` → 仕訳側へ `invoiceId`
 */
export function normalizeLegacyInvoice(raw: LegacyInvoice): NormalizedInvoice {
	const { journalId, depositJournalIds, status, settledManually, ...rest } = raw;

	const links: InvoiceJournalLink[] = [];
	if (journalId) {
		links.push({ journalId, invoiceId: raw.id, generatedFrom: 'invoice' });
	}
	for (const id of depositJournalIds ?? []) {
		links.push({ journalId: id, invoiceId: raw.id });
	}

	const invoice: Invoice = {
		...rest,
		status: status === 'paid' ? 'issued' : status,
		settledManually: status === 'paid' ? true : settledManually
	};
	if (invoice.settledManually === undefined) {
		delete invoice.settledManually;
	}

	return { invoice, links };
}

/**
 * 紐づけを仕訳テーブルに書き込む。仕訳が存在しない ID は無視する
 *
 * @returns 書き込んだ件数
 */
export async function applyInvoiceJournalLinks(
	journals: JournalTable,
	links: InvoiceJournalLink[]
): Promise<number> {
	let applied = 0;
	for (const link of links) {
		const journal = await journals.get(link.journalId);
		if (!journal) continue;
		const updates: { invoiceId: string; generatedFrom?: 'invoice' } = { invoiceId: link.invoiceId };
		if (link.generatedFrom) updates.generatedFrom = link.generatedFrom;
		await journals.update(link.journalId, updates);
		applied++;
	}
	return applied;
}

/**
 * テーブル内の全請求書を新形式に写す（Dexie upgrade 用）
 *
 * @returns 変換した請求書数と、仕訳側に書いた紐づけ数
 */
export async function migrateLegacyInvoices(
	invoices: Table<LegacyInvoice, string>,
	journals: JournalTable
): Promise<{ invoices: number; links: number }> {
	const all = await invoices.toArray();
	let converted = 0;
	let linkCount = 0;

	for (const raw of all) {
		const isLegacy =
			raw.status === 'paid' || raw.journalId !== undefined || raw.depositJournalIds !== undefined;
		if (!isLegacy) continue;

		const { invoice, links } = normalizeLegacyInvoice(raw);
		await invoices.put(invoice as LegacyInvoice);
		linkCount += await applyInvoiceJournalLinks(journals, links);
		converted++;
	}

	return { invoices: converted, links: linkCount };
}
