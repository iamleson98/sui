import { describe, expect, it, vi, beforeEach } from 'vitest';
import { suiCsvCell, suiRowsToCsv, suiDownloadCsv } from '$lib/sui';

// jsdom ships no URL.createObjectURL — capture the blob instead so the CSV
// payload itself can be asserted.
const created: Blob[] = [];
const clickSpy = vi.fn();

beforeEach(() => {
	created.length = 0;
	// NOTE: vitest runs with mockReset:true, which restores module-scope
	// spies before every test — so the prototype spy must be (re)created
	// here, not at module scope.
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
	clickSpy.mockClear();
	URL.createObjectURL = vi.fn((blob: Blob) => {
		created.push(blob);
		return 'blob:mock';
	}) as unknown as typeof URL.createObjectURL;
	URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
});

describe('suiCsvCell', () => {
	it('wraps values in quotes', () => {
		expect(suiCsvCell('hello')).toBe('"hello"');
	});

	it('escapes embedded quotes by doubling them', () => {
		expect(suiCsvCell('say "hi"')).toBe('"say ""hi"""');
	});

	it('renders null and undefined as empty cells', () => {
		expect(suiCsvCell(null)).toBe('""');
		expect(suiCsvCell(undefined)).toBe('""');
	});

	it('serializes dates as ISO strings', () => {
		expect(suiCsvCell(new Date('2025-01-02T03:04:05.000Z'))).toBe('"2025-01-02T03:04:05.000Z"');
	});

	it('prefixes spreadsheet formula triggers (CSV injection guard)', () => {
		expect(suiCsvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
		expect(suiCsvCell('+cmd')).toBe('"\'+cmd"');
		expect(suiCsvCell('-1')).toBe('"\'-1"');
		expect(suiCsvCell('@x')).toBe('"\'@x"');
	});

	it('keeps plain numbers unmodified', () => {
		expect(suiCsvCell(42)).toBe('"42"');
	});
});

describe('suiRowsToCsv', () => {
	it('renders a header row plus one row per entry (CRLF line breaks)', () => {
		const csv = suiRowsToCsv(
			[{ name: 'Ada', city: 'London' }],
			[
				{ id: 'name', header: 'Name', value: (r) => r.name },
				{ id: 'city', value: (r) => r.city }
			]
		);
		expect(csv).toBe('"Name","city"\r\n"Ada","London"');
	});

	it('falls back to the column id when no header is given', () => {
		const csv = suiRowsToCsv([], [{ id: 'x', value: () => 1 }]);
		expect(csv).toBe('"x"');
	});

	it('keeps commas and newlines inside values on one logical row', () => {
		const csv = suiRowsToCsv(
			[{ name: 'a,b\nc', city: 'x' }],
			[
				{ id: 'name', header: 'Name', value: (r) => r.name },
				{ id: 'city', value: (r) => r.city }
			]
		);
		expect(csv.split('\r\n')).toHaveLength(2);
		expect(csv).toContain('"a,b\nc"');
	});
});

describe('suiDownloadCsv', () => {
	it('triggers a download with the given filename and a BOM-prefixed body', async () => {
		suiDownloadCsv(
			[{ name: 'Ada', city: 'London' }],
			[
				{ id: 'name', header: 'Name', value: (r) => r.name },
				{ id: 'city', header: 'City', value: (r) => r.city }
			],
			'people.csv'
		);

		expect(clickSpy).toHaveBeenCalledTimes(1);
		const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
		expect(anchor.download).toBe('people.csv');
		expect(anchor.href).toContain('blob:mock');

		const text = await created[0]!.text();
		// NB: Blob.text() strips a leading BOM per spec — verify it via
		// the raw bytes, and the payload via text()
		const bytes = new Uint8Array(await created[0]!.arrayBuffer());
		expect(bytes[0]).toBe(0xef); // UTF-8 BOM for Excel
		expect(text).toBe('"Name","City"\r\n"Ada","London"');
	});
});
