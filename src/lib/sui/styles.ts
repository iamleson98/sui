import type { SuiButtonColor, SuiFieldVariant, SuiSize } from './types.js';

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

/**
 * Same metrics as {@link SUI_CONTROL} but with `min-h` instead of a fixed
 * height — used by controls that can grow vertically (multi-select chips).
 */
export const SUI_CONTROL_MIN: Record<SuiSize, string> = {
	xs: 'min-h-6 gap-1 px-2 text-xs',
	sm: 'min-h-8 gap-1.5 px-2.5 text-sm',
	md: 'min-h-9 gap-2 px-3 text-sm',
	lg: 'min-h-10 gap-2 px-3.5 text-base',
	xl: 'min-h-12 gap-2.5 px-4 text-base'
};

/**
 * Textarea wrapper metrics — like {@link SUI_CONTROL} but with no height and
 * no horizontal padding: the height is driven by the `<textarea rows>` and the
 * inner `<textarea>` owns its `px-3 py-2` padding, so a 4-row field actually
 * renders four lines tall instead of being squeezed into a one-line box.
 */
export const SUI_TEXTAREA: Record<SuiSize, string> = {
	xs: 'gap-1 text-xs',
	sm: 'gap-1.5 text-sm',
	md: 'gap-2 text-sm',
	lg: 'gap-2 text-base',
	xl: 'gap-2.5 text-base'
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
 * `info` is the normal state and stays neutral like shadcn: the resting
 * border is the theme's `input` colour (set by the control itself) and only
 * focus changes the border and ring, to the theme's `ring` colour. Used by
 * text-entry wrappers (input, textarea) where any DOM focus inside —
 * including mouse clicks — should paint the focused look (native text-field
 * behavior).
 */
export const SUI_FIELD_CONTROL: Record<SuiFieldVariant, string> = {
	info: 'focus-within:border-ring focus-within:ring-ring/50',
	success:
		'border-green-300 bg-green-50/40 dark:border-green-500/40 dark:bg-green-950/20 focus-within:border-green-500 dark:focus-within:border-green-400 focus-within:ring-green-500/25',
	warning:
		'border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/20 focus-within:border-amber-500 dark:focus-within:border-amber-400 focus-within:ring-amber-500/25',
	error:
		'border-red-300 bg-red-50/40 dark:border-red-500/40 dark:bg-red-950/20 focus-within:border-red-500 dark:focus-within:border-red-400 focus-within:ring-red-500/25'
};

/**
 * Field variant classes for button-like triggers (select, combobox,
 * multi-select). Identical hues to {@link SUI_FIELD_CONTROL} but driven by
 * `focus-visible` instead of `focus-within`: those triggers receive DOM focus
 * back from the menu on close (bits-ui focus return / item selection), and
 * only keyboard focus should paint the focused look — otherwise the field
 * keeps looking stuck after an outside click (matches Radix/shadcn).
 */
export const SUI_FIELD_TRIGGER: Record<SuiFieldVariant, string> = {
	info: 'focus-visible:border-ring focus-visible:ring-ring/50',
	success:
		'border-green-300 bg-green-50/40 dark:border-green-500/40 dark:bg-green-950/20 focus-visible:border-green-500 dark:focus-visible:border-green-400 focus-visible:ring-green-500/25',
	warning:
		'border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/20 focus-visible:border-amber-500 dark:focus-visible:border-amber-400 focus-visible:ring-amber-500/25',
	error:
		'border-red-300 bg-red-50/40 dark:border-red-500/40 dark:bg-red-950/20 focus-visible:border-red-500 dark:focus-visible:border-red-400 focus-visible:ring-red-500/25'
};

/**
 * shadcn-svelte primitives (the select trigger, checkbox and switch) paint any
 * `aria-invalid` control with a permanent 3px ring — indistinguishable from
 * a focus ring, and it never goes away on blur or an outside click, so an
 * invalid field looks stuck in focus. sui signals errors through its variant
 * colours instead; these overrides (merged last by `cn`) keep the ring for
 * real keyboard focus only.
 */
export const SUI_INVALID_RING = 'aria-invalid:ring-0 aria-invalid:focus-visible:ring-3';

/**
 * {@link SUI_INVALID_RING} plus the border: an invalid select trigger matches
 * an invalid `SuiInput` (red-300 at rest, red-500 focused) instead of the
 * primitive's always-dark destructive border.
 */
export const SUI_INVALID_TRIGGER = `${SUI_INVALID_RING} aria-invalid:border-red-300 dark:aria-invalid:border-red-500/40 aria-invalid:focus-visible:border-red-500 dark:aria-invalid:focus-visible:border-red-400`;

/** Field variant classes applied to labels (neutral text in the normal state). */
export const SUI_FIELD_LABEL: Record<SuiFieldVariant, string> = {
	info: 'text-foreground',
	success: 'text-green-700 dark:text-green-400',
	warning: 'text-amber-700 dark:text-amber-400',
	error: 'text-red-600 dark:text-red-400'
};

/** Field variant classes applied to hints and messages rendered below a control. */
export const SUI_FIELD_TEXT: Record<SuiFieldVariant, string> = {
	// 700-level on light surfaces: the 600s of green and amber miss the
	// 4.5:1 AA contrast ratio on white (3.2:1 / 3.3:1)
	info: 'text-muted-foreground',
	success: 'text-green-700 dark:text-green-400',
	warning: 'text-amber-700 dark:text-amber-400',
	error: 'text-red-600 dark:text-red-400'
};

/**
 * Extra end padding applied to a select/combobox trigger while the clear (✕)
 * button overlay is visible, so the value never slides under the button.
 * Reserves from the end edge: ✕ hit area (20–24px) + gap (4px) + chevron
 * (16px) + gap (4px) — the chevron is pinned into this zone, see
 * {@link SUI_CHEVRON_PIN}.
 */
export const SUI_CLEAR_PE: Record<SuiSize, string> = {
	xs: 'pe-13',
	sm: 'pe-13',
	md: 'pe-14',
	lg: 'pe-14',
	xl: 'pe-14'
};

/**
 * Position of the clear (✕) button overlay from the trigger's end edge —
 * sits between the value and the chevron (the chevron stays rightmost).
 */
export const SUI_CLEAR_END: Record<SuiSize, string> = {
	xs: 'end-7',
	sm: 'end-7',
	md: 'end-7',
	lg: 'end-7',
	xl: 'end-7'
};

/** Hit-area size of the clear (✕) button overlay per control size. */
export const SUI_CLEAR_SIZE: Record<SuiSize, string> = {
	xs: 'size-5',
	sm: 'size-5',
	md: 'size-6',
	lg: 'size-6',
	xl: 'size-6'
};

/**
 * Pins the trigger's trailing chevron to the far end edge while the clear (✕)
 * overlay is visible. Without this, the extra end padding pushes the chevron
 * left of the ✕ and leaves a large dead gap between the ✕ and the border.
 * The trigger must be `relative` (all sui triggers are). Targets the chevron
 * as the trigger's last direct `<svg>` child (the shadcn select-trigger and
 * the sui combobox both render it there; icons passed via props are wrapped
 * in `<span>`s and never match).
 */
export const SUI_CHEVRON_PIN =
	'[&>svg:last-of-type]:absolute [&>svg:last-of-type]:end-2 [&>svg:last-of-type]:top-1/2 [&>svg:last-of-type]:-translate-y-1/2';

/**
 * Chip (multi-select badge) metrics per control size. Chips step down as the
 * control size steps up so a chip row never outgrows its trigger.
 */
export const SUI_CHIP: Record<SuiSize, string> = {
	xs: 'text-[10px] gap-0.5 px-1.5 py-0 h-4 rounded-full',
	sm: 'text-[11px] gap-1 px-2 py-0 h-5 rounded-full',
	md: 'text-xs gap-1 px-2 py-0 h-5 rounded-full',
	lg: 'text-xs gap-1 px-2.5 py-0 h-6 rounded-full',
	xl: 'text-sm gap-1 px-2.5 py-0 h-7 rounded-full'
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

// ---------------------------------------------------------------- buttons

/** The button variants a `color` tints (`destructive` is red by definition). */
export type SuiButtonTone = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';

/**
 * Semantic button colours as CSS tokens: `--sui-btn` (the colour itself)
 * and `--sui-btn-fg` (text on a solid fill). Every fill keeps WCAG AA
 * contrast (≥ 4.5:1) with its text in both themes — hence green-700, and
 * dark text on amber. `--sui-btn-text-override` replaces the derived text
 * tone where the mix would be too light (amber on a light theme).
 */
export const SUI_BUTTON_COLOR: Record<SuiFieldVariant, string> = {
	info: '[--sui-btn:var(--color-blue-600)] [--sui-btn-fg:var(--color-white)]',
	success: '[--sui-btn:var(--color-green-700)] [--sui-btn-fg:var(--color-white)]',
	warning:
		'[--sui-btn:var(--color-amber-400)] [--sui-btn-fg:var(--color-amber-950)] [--sui-btn-text-override:var(--color-amber-800)] dark:[--sui-btn-text-override:initial]',
	error: '[--sui-btn:var(--color-red-600)] [--sui-btn-fg:var(--color-white)]'
};

/**
 * Tones derived from `--sui-btn` — computed with `color-mix`, so ANY colour
 * (semantic or custom) gets readable soft / outline / ghost / link styles:
 * text is the colour pulled 25% toward the foreground (darker on light
 * themes, lighter on dark ones), tints are translucent washes of it.
 */
const SUI_BUTTON_DERIVED =
	'[--sui-btn-text:var(--sui-btn-text-override,color-mix(in_oklab,var(--sui-btn)_75%,var(--color-foreground)))] [--sui-btn-tint:color-mix(in_oklab,var(--sui-btn)_14%,transparent)] [--sui-btn-tint-strong:color-mix(in_oklab,var(--sui-btn)_24%,transparent)] [--sui-btn-line:color-mix(in_oklab,var(--sui-btn)_45%,transparent)] [--sui-btn-hover:color-mix(in_oklab,var(--sui-btn)_85%,var(--color-black))]';

/** Per-variant classes reading the colour tokens (merged over the shadcn variant). */
export const SUI_BUTTON_TONE: Record<SuiButtonTone, string> = {
	primary:
		'bg-(--sui-btn) text-(--sui-btn-fg) hover:bg-(--sui-btn-hover) focus-visible:border-(--sui-btn) focus-visible:ring-(--sui-btn-line)',
	secondary:
		'bg-(--sui-btn-tint) text-(--sui-btn-text) hover:bg-(--sui-btn-tint-strong) aria-expanded:bg-(--sui-btn-tint-strong) aria-expanded:text-(--sui-btn-text) focus-visible:border-(--sui-btn) focus-visible:ring-(--sui-btn-line)',
	outline:
		'border-(--sui-btn-line) bg-transparent text-(--sui-btn-text) hover:bg-(--sui-btn-tint) hover:text-(--sui-btn-text) aria-expanded:bg-(--sui-btn-tint) aria-expanded:text-(--sui-btn-text) dark:border-(--sui-btn-line) dark:bg-transparent dark:hover:bg-(--sui-btn-tint) focus-visible:border-(--sui-btn) focus-visible:ring-(--sui-btn-line)',
	ghost:
		'text-(--sui-btn-text) hover:bg-(--sui-btn-tint) hover:text-(--sui-btn-text) aria-expanded:bg-(--sui-btn-tint) aria-expanded:text-(--sui-btn-text) dark:hover:bg-(--sui-btn-tint) focus-visible:ring-(--sui-btn-line)',
	link: 'text-(--sui-btn-text) focus-visible:ring-(--sui-btn-line)'
};

/**
 * Classes + inline style that colour a button. Semantic colours resolve to
 * {@link SUI_BUTTON_COLOR} tokens; any other string is used as a CSS
 * colour through the `--sui-btn` custom property (text on solid fills
 * defaults to white — override with `style="--sui-btn-fg: …"`).
 */
export function suiButtonColor(
	color: SuiButtonColor | undefined,
	variant: string
): { class: string; style: string } {
	if (!color || !(variant in SUI_BUTTON_TONE)) return { class: '', style: '' };
	const tone = SUI_BUTTON_TONE[variant as SuiButtonTone];
	if (color in SUI_BUTTON_COLOR) {
		return {
			class: `${SUI_BUTTON_COLOR[color as SuiFieldVariant]} ${SUI_BUTTON_DERIVED} ${tone}`,
			style: ''
		};
	}
	return {
		class: `[--sui-btn-fg:var(--color-white)] ${SUI_BUTTON_DERIVED} ${tone}`,
		style: `--sui-btn: ${color};`
	};
}
