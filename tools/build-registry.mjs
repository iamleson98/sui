// Generates registry.json from the files on disk, then builds the
// shadcn-svelte registry into static/r (served at /r/sui.json).
//
//   npm run registry:build
//
// Consumers install with:  npx shadcn-svelte@latest add <host>/r/sui.json
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const LIB = 'src/lib';

function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

// every file of the library…
const files = walk(join(LIB, 'sui')).sort();
// …plus the local deviations to the vendored shadcn `command` wrappers
// (container-scoped scrollIntoView — see the README's Selects section).
// They install AFTER the stock `command` component so they win.
const patched = [
	'components/ui/command/command-item.svelte',
	'components/ui/command/command-group.svelte',
	'components/ui/command/contained-scroll-into-view.ts'
].map((p) => join(LIB, p));

const registry = {
	$schema: 'https://shadcn-svelte.com/schema/registry.json',
	name: 'sui',
	homepage: 'https://github.com/iamleson98/sui',
	items: [
		{
			name: 'sui',
			type: 'registry:lib',
			title: 'sui',
			description:
				'Batteries-included form controls, schema-driven forms (zod v4 / Standard Schema), selects with REST infinite scroll, date & time pickers and a virtualized data table, on shadcn-svelte + bits-ui.',
			dependencies: [
				'zod',
				'bits-ui',
				'@internationalized/date',
				'@lucide/svelte',
				'@tanstack/svelte-table',
				'@tanstack/svelte-virtual',
				'vaul-svelte',
				'tailwind-variants',
				'cn'
			],
			registryDependencies: [
				'button',
				'calendar',
				'range-calendar',
				'checkbox',
				'command',
				'drawer',
				'dropdown-menu',
				'popover',
				'radio-group',
				'select',
				'switch'
			],
			files: [...files, ...patched].map((path) => ({
				path,
				type: 'registry:lib',
				// targets are relative to the project's `lib` alias directory
				target: path.slice(`${LIB}/`.length)
			}))
		}
	]
};

writeFileSync('registry.json', JSON.stringify(registry, null, '\t') + '\n');
execFileSync('npx', ['shadcn-svelte', 'registry', 'build'], { stdio: 'inherit' });
console.log(`registry: ${registry.items[0].files.length} files → static/r/sui.json`);
