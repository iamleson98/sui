import type { SuiFieldVariant, SuiSize } from './types.js';

/**
 * The single source of truth for control sizes.
 *
 * `control` classes are applied to every interactive control wrapper
 * (buttons, inputs, select/combobox/multi-select triggers) so their
 * heights, paddings, gaps and font sizes match exactly across the library.
 *
 * The scale intentionally aligns with the underlying shadcn-svelte sizes:
 * xs = h-6, sm = h-8, md = h-9 (shadcn default), lg = h-10, xl = h-12.
 */
export const SUI_CONTROL: Record<SuiSize, string> = {
	xs: 'h-6 gap-1 px-2 text-xs',
	sm: 'h-8 gap-1.5 px-2.5 text-sm',
	md: 'h-9 gap-2 px-3 text-sm',
	lg: 'h-10 gap-2 px-3.5 text-base',
	xl: 'h-12 gap-2.5 px-4 text-base'
};

/** Square (icon-only button) sizes — same heights as {@link SUI_CONTROL}. */
export const SUI_SQUARE: Record<SuiSize, string> = {
	xs: 'size-6',
	sm: 'size-8',
	md: 'size-9',
	lg: 'size-10',
	xl: 'size-12'
};

/** Icon sizes tuned per control size. */
export const SUI_ICON: Record<SuiSize, string> = {
	xs: 'size-3',
	sm: 'size-3.5',
	md: 'size-4',
	lg: 'size-4.5',
	xl: 'size-5'
};

/** Label text sizes per control size. */
export const SUI_LABEL: Record<SuiSize, string> = {
	xs: 'text-[11px]',
	sm: 'text-xs',
	md: 'text-sm',
	lg: 'text-sm',
	xl: 'text-base'
};

/** Helper/sub-text sizes per control size. */
export const SUI_SUBTEXT: Record<SuiSize, string> = {
	xs: 'text-[10px]',
	sm: 'text-[11px]',
	md: 'text-xs',
	lg: 'text-xs',
	xl: 'text-sm'
};

/** Typical content width per size, used by button skeletons. */
export const SUI_SKELETON_W: Record<SuiSize, string> = {
	xs: 'w-14',
	sm: 'w-20',
	md: 'w-24',
	lg: 'w-28',
	xl: 'w-36'
};

/**
 * Field variant classes applied to control wrappers (border + focus ring).
 * `info` (blue) is the normal state.
 */
export const SUI_FIELD_CONTROL: Record<SuiFieldVariant, string> = {
	info: 'border-blue-300 dark:border-blue-500/40 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-blue-500/25',
	success:
		'border-green-300 bg-green-50/40 dark:border-green-500/40 dark:bg-green-950/20 focus-within:border-green-500 dark:focus-within:border-green-400 focus-within:ring-green-500/25',
	warning:
		'border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/20 focus-within:border-amber-500 dark:focus-within:border-amber-400 focus-within:ring-amber-500/25',
	error:
		'border-red-300 bg-red-50/40 dark:border-red-500/40 dark:bg-red-950/20 focus-within:border-red-500 dark:focus-within:border-red-400 focus-within:ring-red-500/25'
};

/** Field variant classes applied to messages rendered below a control. */
export const SUI_FIELD_TEXT: Record<SuiFieldVariant, string> = {
	info: 'text-blue-600 dark:text-blue-400',
	success: 'text-green-600 dark:text-green-400',
	warning: 'text-amber-600 dark:text-amber-400',
	error: 'text-red-600 dark:text-red-400'
};

/**
 * Resolves the effective field variant: validation errors always win.
 */
export function suiEffectiveVariant(
	variant: SuiFieldVariant,
	errors: readonly string[] | undefined
): SuiFieldVariant {
	if (errors !== undefined && errors.length > 0) return 'error';
	return variant;
}
