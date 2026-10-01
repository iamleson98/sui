// Every demo page is static content — prerender at build time so the served
// HTML is instant and fully crawlable. Server endpoints (src/routes/api)
// opt out individually with `export const prerender = false`.
export const prerender = true;
