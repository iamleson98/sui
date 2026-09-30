import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { focusFirstInvalid } from '$lib/sui/form';
import { SuiSelect } from '$lib/sui';
import InputHarness from './harness/input-harness.svelte';

describe('focusFirstInvalid', () => {
        it('focuses the first invalid control inside the root', () => {
                const root = document.createElement('div');
                root.innerHTML = `
                        <input data-sui-input />
                        <div data-invalid="true"><input id="second" /></div>
                `;
                document.body.appendChild(root);
                try {
                        const focused = focusFirstInvalid(root);
                        expect(focused).toBe(true);
                        expect(document.activeElement?.id).toBe('second');
                } finally {
                        root.remove();
                }
        });

        it('returns false when nothing is invalid', () => {
                const root = document.createElement('div');
                root.innerHTML = '<input />';
                expect(focusFirstInvalid(root)).toBe(false);
        });

        it('skips disabled and hidden controls', () => {
                const root = document.createElement('div');
                root.innerHTML = `
                        <div data-invalid="true">
                                <input type="hidden" />
                                <button disabled>nope</button>
                                <button id="target">yep</button>
                        </div>
                `;
                document.body.appendChild(root);
                try {
                        expect(focusFirstInvalid(root)).toBe(true);
                        expect(document.activeElement?.id).toBe('target');
                } finally {
                        root.remove();
                }
        });

        it('focuses a select trigger that carries data-invalid itself', async () => {
                // trigger buttons carry data-invalid directly — the helper must match
                // the element itself, not only descendants of [data-invalid]
                const { container } = render(SuiSelect, {
                        label: 'Country',
                        items: [{ value: 'vn', label: 'Vietnam' }]
                });
                const trigger = container.querySelector('[data-sui-trigger]') as HTMLElement;
                trigger.setAttribute('data-invalid', 'true');
                const focused = focusFirstInvalid(container);
                expect(focused).toBe(true);
                expect(document.activeElement).toBe(trigger);
        });

        it('focuses an invalid sui input from a rendered harness', async () => {
                const { container } = render(InputHarness, { label: 'Email' });
                const input = screen.getByLabelText('Email') as HTMLInputElement;
                // mark the field invalid the way the component does
                const wrapper = container.querySelector('[data-sui-control="input"]') as HTMLElement;
                wrapper.setAttribute('data-invalid', 'true');
                expect(focusFirstInvalid(container)).toBe(true);
                expect(document.activeElement).toBe(input);
        });
});
