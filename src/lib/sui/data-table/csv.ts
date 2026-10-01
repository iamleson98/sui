/**
 * CSV export for table data — RFC 4180 compliant (quotes, commas, newlines
 * and tabs inside values are escaped; a leading quote-looking cell is
 * prefixed to protect it from spreadsheet formula injection).
 */

export type SuiCsvColumn<T> = {
	/** Column id (used for the header row fallback). */
	id: string;
	/** Header cell text. Default: the id. */
	header?: string;
	/** Raw cell value for a row (dates/numbers/strings/null). */
	value: (row: T) => unknown;
};

/** Escape a single CSV cell. */
export function suiCsvCell(value: unknown): string {
	let text =
		value === null || value === undefined
			? ''
			: value instanceof Date
				? value.toISOString()
				: String(value);
	// protect spreadsheet formula injection (=, +, -, @ prefixes)
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return `"${text.replace(/"/g, '""')}"`;
}

/** Render rows + columns to a CSV document string. */
export function suiRowsToCsv<T>(rows: T[], columns: SuiCsvColumn<T>[]): string {
	const head = columns.map((c) => suiCsvCell(c.header ?? c.id)).join(',');
	const body = rows.map((row) => columns.map((c) => suiCsvCell(c.value(row))).join(','));
	return [head, ...body].join('\r\n');
}

/** Build the CSV and trigger a browser download. SSR-safe no-op elsewhere. */
export function suiDownloadCsv<T>(
	rows: T[],
	columns: SuiCsvColumn<T>[],
	filename = 'sui-export.csv'
): void {
	if (typeof document === 'undefined') return;
	const csv = suiRowsToCsv(rows, columns);
	const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
