import { blobStore } from './_shared/core.mjs';

export default async () => {
	const series = await blobStore().get('series', { type: 'json' });
	return new Response(JSON.stringify(series ?? { dates: [], totals: [], artists: {} }), {
		headers: {
			'content-type': 'application/json',
			'cache-control': 'public, max-age=600',
		},
	});
};

export const config = { path: '/api/history' };
