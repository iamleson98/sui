import type { Component, Snippet } from 'svelte';

/**
 * The sui size scale, shared by every component in the library.
 *
 * All controls (buttons, inputs, selects, comboboxes, multi-selects) map to the
 * exact same physical height per size, so they can be composed in a single row
 * — e.g. an `sm` input next to an `sm` button aligns pixel-perfectly.
 */
export type SuiSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Semantic field color variants.
 *
 * - `info` — blue, the neutral/normal state (default)
 * - `success` — green
 * - `warning` — yellow
 * - `error` — red
 *
 * Validation errors (from a `schema`) always take precedence and force the
 * `error` appearance, regardless of the configured variant.
 */
export type SuiFieldVariant = 'info' | 'success' | 'warning' | 'error';

/**
 * A Svelte component that renders an icon — e.g. any lucide-svelte icon
 * or any custom component accepting a `class` prop.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SuiIconComponent = Component<any>;

/**
 * A snippet rendered in the trailing interactive area of a control.
 * Use it for clear buttons, password-visibility toggles, loading spinners, …
 */
export type SuiActionSnippet = Snippet<[{ size: SuiSize }]>;

/**
 * The item shape accepted by all list-based components
 * (Select, Combobox, MultiSelect).
 */
export type SuiItem<V = string> = {
	value: V;
	label: string;
	/** Optional secondary text rendered below the label. */
	description?: string;
	disabled?: boolean;
};

/** Anything that can be used as an item key (for dedupe / selection tracking). */
export type SuiItemKey = string | number | boolean | null | undefined;
