/**
 * Local search for the select family. cmdk's built-in scorer compares raw
 * letters, so "toan" never finds "Toán" and "dai so" never finds "Đại số":
 * every option list here folds accents (and đ) and case away before
 * matching, on both sides.
 */

const COMBINING_MARKS = /\p{M}/gu;

/** Lowercases and strips accents (and đ → d), so "Đại Số" and "dai so" compare equal. */
export function suiFold(text: string): string {
	return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '').replaceAll('đ', 'd');
}

/**
 * Scores an option against a search: every word of the search must appear
 * in the option's text or keywords; a word that starts a word of the text
 * ranks above one found mid-word. 0 hides the option. Same signature as
 * the Command `filter` prop.
 */
export function suiFilter(value: string, search: string, keywords: string[] = []): number {
	const words = suiFold(search).split(/\s+/).filter(Boolean);
	if (words.length === 0) return 1;
	const haystack = suiFold([value, ...keywords].join(' '));
	let score = 1;
	for (const word of words) {
		if (!haystack.includes(word)) return 0;
		if (!haystack.startsWith(word) && !haystack.includes(` ${word}`)) score = 0.5;
	}
	return score;
}
