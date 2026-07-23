import { refresh } from './_shared/core.mjs';

export default async () => {
	const payload = await refresh();
	return new Response(`refreshed ${payload.rows.length} artists at ${payload.generatedAt}`);
};

export const config = { schedule: '0 * * * *' };
