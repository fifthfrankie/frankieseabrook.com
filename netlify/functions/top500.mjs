import { getStore } from '@netlify/blobs';
import { refresh } from './_shared/core.mjs';

const STALE_MS = 26 * 3600e3;

export default async () => {
	const store = getStore('top500');
	let payload = await store.get('latest', { type: 'json' });
	if (!payload || Date.now() - Date.parse(payload.generatedAt) > STALE_MS) {
		try {
			payload = await refresh();
		} catch (err) {
			if (!payload) {
				return new Response(JSON.stringify({ error: String(err) }), {
					status: 502,
					headers: { 'content-type': 'application/json' },
				});
			}
		}
	}
	return new Response(JSON.stringify(payload), {
		headers: {
			'content-type': 'application/json',
			'cache-control': 'public, max-age=600',
		},
	});
};

export const config = { path: '/api/top500' };
