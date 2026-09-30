/**
 * sui — opinionated, batteries-included Svelte 5 component library
 * built on top of shadcn-svelte.
 *
 * - One-liner form fields: label, sub-text, icons, actions, sizes, variants
 * - zod v4 schema validation per field
 * - Infinite-scroll selects fed by REST sources (cursor or offset)
 * - TanStack-powered data table with virtual scrolling
 * - Size-matched skeletons for every control
 */

// core types & styles
export type { SuiSize, SuiFieldVariant, SuiItem, SuiIconComponent, SuiActionSnippet } from './types.js';
export {
        SUI_CONTROL,
        SUI_CONTROL_MIN,
        SUI_SQUARE,
        SUI_ICON,
        SUI_LABEL,
        SUI_SUBTEXT,
        SUI_SKELETON_W,
        SUI_FIELD_CONTROL,
        SUI_FIELD_TEXT,
        suiEffectiveVariant
} from './styles.js';

// zod validation helpers
export { suiValidate, shouldValidate, type SuiValidateOn } from './zod.js';
export { SuiFieldState } from './field.svelte.js';

// pagination / infinite scroll
export {
        offsetSource,
        cursorSource,
        type SuiSource,
        type SuiPageRequest,
        type SuiPageResult,
        type SuiOffsetPage,
        type SuiCursorPage
} from './pagination.js';
export { SuiInfiniteList, type SuiInfiniteListOptions } from './infinite-list.svelte.js';
export { observeSentinel, findScrollParent } from './intersection.js';
export { fitChipCount, type FitChipOptions } from './chip-fit.js';

// skeleton primitives
export * from './skeleton/index.js';

// components
export * from './button/index.js';
export * from './input/index.js';
export * from './checkbox/index.js';
export * from './radio-group/index.js';
export * from './switch/index.js';
export * from './select/index.js';
export * from './combobox/index.js';
export * from './multi-select/index.js';
export * from './data-table/index.js';
