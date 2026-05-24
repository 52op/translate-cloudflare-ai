export interface Env {
	AI: Ai;
	URL_PREFIX: string;
	ALLOW_ORIGINS?: string;
	API_TOKEN?: string;
}

function checkOrigin(request: Request, allowedOrigins?: string): boolean {
	if (!allowedOrigins) return true;
	const origin = request.headers.get('Origin');
	if (!origin) return false;
	return allowedOrigins.split(',').map(s => s.trim()).some(o => {
		if (o === '*') return true;
		if (o.startsWith('*.')) return origin.endsWith(o.slice(1));
		return origin === o;
	});
}

function checkToken(request: Request, apiToken?: string): boolean {
	if (!apiToken) return true;
	const auth = request.headers.get('Authorization');
	return auth === `Bearer ${apiToken}`;
}

function forbid(msg: string) {
	return new Response(JSON.stringify({ message: msg }), { status: 403 });
}

export default {
	async fetch(request: Request, env: Env) {
		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
		}

		if (!request.headers.get('Content-Type')?.includes('application/json')) {
			return new Response(JSON.stringify({ message: 'Unsupported Media Type' }), { status: 415 });
		}

		const urlPath = new URL(request.url).pathname;
		if (env.URL_PREFIX && !urlPath.startsWith(env.URL_PREFIX)) {
			return forbid('Forbidden');
		}

		const originOk = checkOrigin(request, env.ALLOW_ORIGINS);
		const tokenOk = checkToken(request, env.API_TOKEN);
		if (!originOk && !tokenOk) {
			return forbid('Forbidden');
		}

		try {
			const { source_lang, target_lang, text_list } = await request.json() as any;
			if (!Array.isArray(text_list) || !text_list.length) {
				return new Response(JSON.stringify({ message: 'Invalid text_list' }), { status: 400 });
			}
			const translations = await Promise.all(text_list.map(async (text: string) => {
				const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
					text,
					target_lang: target_lang === "zh-CN" ? "chinese" : target_lang,
					...(source_lang && source_lang !== "auto" ? { source_lang } : {}),
				});
				return {
					detected_source_lang: source_lang,
					text: response.translated_text
				};
			}));

			return new Response(JSON.stringify({ translations, message: 'ok' }));
		} catch (error) {
			return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
		}
	},
}