export interface Env {
	AI: Ai;
	URL_PREFIX: string;
	ALLOW_ORIGINS?: string;
	API_TOKEN?: string;
	MODEL?: string;
	SYSTEM_PROMPT?: string;
}

const TRANSLATION_MODELS = ['m2m100', 'indictrans']

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

function isTranslationModel(model: string) {
	return TRANSLATION_MODELS.some(id => model.includes(id))
}

function normalizeLang(lang: string) {
	return lang === "zh-CN" ? "chinese" : lang
}

function formatLang(lang: string) {
	return lang.charAt(0).toUpperCase() + lang.slice(1)
}

function extractText(response: any): string {
	return response.response
		|| response.choices?.[0]?.message?.content
		|| response.result?.response
		|| ''
}

async function translateWithLLM(ai: Ai, model: string, text: string, sourceLang: string, targetLang: string, systemPrompt: string) {
	const targetLangName = normalizeLang(targetLang)
	const langTarget = formatLang(targetLangName)
	const prompt = systemPrompt || `You are a professional translator. Translate the user's text to ${langTarget}. Output only the translated text, no explanations or notes.`
	const messages: { role: string; content: string }[] = [{ role: 'system', content: prompt }]
	if (sourceLang && sourceLang !== 'auto') {
		messages.push({ role: 'user', content: `Translate from ${formatLang(sourceLang)} to ${langTarget}: ${text}` })
	} else {
		messages.push({ role: 'user', content: text })
	}
	const resp = await ai.run(model, { messages })
	return { text: extractText(resp) }
}

async function translateWithTranslationModel(ai: Ai, model: string, text: string, sourceLang: string, targetLang: string) {
	const response = await ai.run(model, {
		text,
		target_lang: normalizeLang(targetLang),
		...(sourceLang && sourceLang !== "auto" ? { source_lang: sourceLang } : {}),
	})
	return { text: response.translated_text }
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

			const model = env.MODEL || '@cf/meta/m2m100-1.2b'
			const translate = isTranslationModel(model) ? translateWithTranslationModel : translateWithLLM

			const translations = await Promise.all(text_list.map(async (text: string) => {
				const result = await translate(env.AI, model, text, source_lang, target_lang, env.SYSTEM_PROMPT || '')
				return { detected_source_lang: source_lang || 'auto', model, ...result }
			}));

			return new Response(JSON.stringify({ translations, message: 'ok' }));
		} catch (error) {
			return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
		}
	},
}