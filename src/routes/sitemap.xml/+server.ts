import { SITE_ORIGIN, SITE_ROUTES } from '$lib/demo/site';
import type { RequestHandler } from './$types';

// Prerendered at build time from the shared route table.
export const prerender = true;

export const GET: RequestHandler = async () => {
	const urls = SITE_ROUTES.map((route) => {
		const loc = `${SITE_ORIGIN}${route.path === '/' ? '' : route.path}`;
		return [
			'\t<url>',
			`\t\t<loc>${loc}</loc>`,
			'\t\t<changefreq>monthly</changefreq>',
			'\t</url>'
		].join('\n');
	}).join('\n');

	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		urls,
		'</urlset>'
	].join('\n');

	return new Response(xml, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
