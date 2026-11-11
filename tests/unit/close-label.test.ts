import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CloseLabelHarness from './harness/close-label-harness.svelte';

describe.each(['dialog', 'sheet'] as const)('the close button of a %s', (kind) => {
	it('takes its screen-reader label from the sui strings', () => {
		render(CloseLabelHarness, { kind });
		expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
	});
});
