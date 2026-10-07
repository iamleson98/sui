#!/usr/bin/env python3
"""Rewrite demo-page barrel imports ($lib/sui) into per-family subpath imports.

The SvelteKit client bundler cannot tree-shake unused re-exports through the
sui barrel, so a barrel import put the entire library (data table + TanStack
included) into every page's graph. Family paths keep each page's graph lean.
Displayed code samples in the docs keep using the barrel — consumers' own
bundlers shake their apps, this only affects how the demo fetches code.
"""
import pathlib

R = 'src/routes'

edits = {
    f'{R}/+layout.svelte': [
        ("import { SuiIconButton } from '$lib/sui';",
         "import SuiIconButton from '$lib/sui/button/icon-button.svelte';"),
    ],
    f'{R}/+page.svelte': [
        ("import { SuiButton } from '$lib/sui';",
         "import { SuiButton } from '$lib/sui/button/index.js';"),
    ],
    f'{R}/button/+page.svelte': [
        ("import { SuiButton, SuiIconButton, SuiButtonSkeleton, SuiIconButtonSkeleton } from '$lib/sui';",
         "import {\n\tSuiButton,\n\tSuiIconButton,\n\tSuiButtonSkeleton,\n\tSuiIconButtonSkeleton\n} from '$lib/sui/button/index.js';"),
    ],
    f'{R}/input/+page.svelte': [
        ("import { SuiInput, SuiTextarea, SuiInputSkeleton, SuiTextareaSkeleton } from '$lib/sui';",
         "import {\n\tSuiInput,\n\tSuiTextarea,\n\tSuiInputSkeleton,\n\tSuiTextareaSkeleton\n} from '$lib/sui/input/index.js';"),
    ],
    f'{R}/selection/+page.svelte': [
        ("""	import {
		SuiSelect,
		SuiCombobox,
		SuiMultiSelect,
		SuiSelectSkeleton,
		SuiComboboxSkeleton,
		SuiMultiSelectSkeleton,
		cursorSource,
		offsetSource,
		type SuiItem,
		type SuiSource
	} from '$lib/sui';""",
         """	import { SuiSelect, SuiSelectSkeleton } from '$lib/sui/select/index.js';
	import { SuiCombobox, SuiComboboxSkeleton } from '$lib/sui/combobox/index.js';
	import { SuiMultiSelect, SuiMultiSelectSkeleton } from '$lib/sui/multi-select/index.js';
	import { cursorSource, offsetSource, type SuiSource } from '$lib/sui/pagination.js';
	import type { SuiItem } from '$lib/sui/types.js';"""),
    ],
    f'{R}/toggles/+page.svelte': [
        ("import { SuiCheckbox, SuiSwitch, SuiRadioGroup, SuiCheckboxSkeleton, SuiRadioSkeleton, SuiSwitchSkeleton } from '$lib/sui';",
         """import { SuiCheckbox, SuiCheckboxSkeleton } from '$lib/sui/checkbox/index.js';
import { SuiSwitch, SuiSwitchSkeleton } from '$lib/sui/switch/index.js';
import { SuiRadioGroup, SuiRadioSkeleton } from '$lib/sui/radio-group/index.js';"""),
    ],
    f'{R}/data-table/+page.svelte': [
        ("import { SuiDataTable, suiColumn, renderComponent, type SuiDataTableSize, type SuiDataTableColumn } from '$lib/sui';",
         "import {\n\tSuiDataTable,\n\tsuiColumn,\n\trenderComponent,\n\ttype SuiDataTableSize,\n\ttype SuiDataTableColumn\n} from '$lib/sui/data-table/index.js';"),
    ],
    f'{R}/skeletons/+page.svelte': [
        ("""	import {
		SuiButtonSkeleton,
		SuiIconButtonSkeleton,
		SuiInputSkeleton,
		SuiTextareaSkeleton,
		SuiSelectSkeleton,
		SuiComboboxSkeleton,
		SuiMultiSelectSkeleton,
		SuiCheckboxSkeleton,
		SuiRadioSkeleton,
		SuiSwitchSkeleton,
		SuiDataTableSkeleton
	} from '$lib/sui';""",
         """	import { SuiButtonSkeleton, SuiIconButtonSkeleton } from '$lib/sui/button/index.js';
	import { SuiInputSkeleton, SuiTextareaSkeleton } from '$lib/sui/input/index.js';
	import { SuiSelectSkeleton } from '$lib/sui/select/index.js';
	import { SuiComboboxSkeleton } from '$lib/sui/combobox/index.js';
	import { SuiMultiSelectSkeleton } from '$lib/sui/multi-select/index.js';
	import { SuiCheckboxSkeleton } from '$lib/sui/checkbox/index.js';
	import { SuiRadioSkeleton } from '$lib/sui/radio-group/index.js';
	import { SuiSwitchSkeleton } from '$lib/sui/switch/index.js';
	import { SuiDataTableSkeleton } from '$lib/sui/data-table/index.js';"""),
    ],
    f'{R}/validation/+page.svelte': [
        ("""	import {
		SuiInput,
		SuiTextarea,
		SuiCheckbox,
		SuiRadioGroup,
		SuiSelect,
		SuiButton,
		SuiMultiSelect,
		focusFirstInvalid
	} from '$lib/sui';""",
         """	import { SuiInput, SuiTextarea } from '$lib/sui/input/index.js';
	import { SuiCheckbox } from '$lib/sui/checkbox/index.js';
	import { SuiRadioGroup } from '$lib/sui/radio-group/index.js';
	import { SuiSelect } from '$lib/sui/select/index.js';
	import { SuiButton } from '$lib/sui/button/index.js';
	import { SuiMultiSelect } from '$lib/sui/multi-select/index.js';
	import { focusFirstInvalid } from '$lib/sui/form.js';"""),
    ],
    f'{R}/pagination/+page.svelte': [
        ("import { cursorSource, SuiCombobox } from '$lib/sui';",
         "import { SuiCombobox } from '$lib/sui/combobox/index.js';\n\timport { cursorSource } from '$lib/sui/pagination.js';"),
        ("import { offsetSource, SuiMultiSelect } from '$lib/sui';",
         "import { SuiMultiSelect } from '$lib/sui/multi-select/index.js';\n\timport { offsetSource } from '$lib/sui/pagination.js';"),
    ],
}

for path, pairs in edits.items():
    f = pathlib.Path(path)
    src = f.read_text()
    for old, new in pairs:
        if old not in src:
            print(f'MISS in {path}: {old[:60]!r}')
            continue
        src = src.replace(old, new)
    f.write_text(src)
    print(f'ok {path}')
