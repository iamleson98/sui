<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import SuiIconButton from '$lib/sui/button/icon-button.svelte';
	import { theme } from '$lib/demo/theme.svelte';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: '/', label: 'Home' },
		{ href: '/showcase', label: 'Showcase' },
		{ href: '/button', label: 'Button' },
		{ href: '/input', label: 'Input' },
		{ href: '/selection', label: 'Selection' },
		{ href: '/toggles', label: 'Toggles' },
		{ href: '/data-table', label: 'Data Table' },
		{ href: '/skeletons', label: 'Skeletons' },
		{ href: '/validation', label: 'Validation' },
		{ href: '/pagination', label: 'Pagination' }
	];

	// The /showcase route ships its own full-bleed app shell (sidebar,
	// command palette, toasts) — the demo-site chrome only wraps docs pages.
	const bare = $derived(page.url.pathname.startsWith('/showcase'));

	$effect(() => {
		document.documentElement.classList.toggle('dark', theme.dark);
	});
</script>

{#if bare}
	{@render children()}
{:else}
	<div class="flex min-h-screen flex-col bg-background text-foreground">
		<header class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
			<div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
				<a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
					<span
						class="flex size-6 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground"
						>s</span
					>
					sui
				</a>
				<nav
					class="hide-scrollbar flex flex-1 items-center gap-1 overflow-x-auto"
					aria-label="Main"
				>
					{#each links as link (link.href)}
						<a
							href={link.href}
							class="rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{link.label}
						</a>
					{/each}
				</nav>
				<SuiIconButton
					icon={theme.dark ? SunIcon : MoonIcon}
					label={theme.dark ? 'Switch to light theme' : 'Switch to dark theme'}
					size="sm"
					variant="ghost"
					onclick={() => theme.toggle()}
				/>
				<a
					href="https://github.com/iamleson98/sui"
					class="hidden text-muted-foreground hover:text-foreground sm:block"
					aria-label="GitHub repository"
				>
					<ExternalLinkIcon class="size-4.5" />
				</a>
			</div>
		</header>

		<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
			{@render children()}
		</main>

		<footer class="border-t py-6 text-center text-xs text-muted-foreground">
			sui · Svelte 5 + shadcn-svelte + Tailwind CSS v4 · MIT
		</footer>
	</div>
{/if}
