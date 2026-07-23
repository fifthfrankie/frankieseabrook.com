import { getStore } from '@netlify/blobs';

const KWORB_URL = 'https://kworb.net/spotify/listeners.html';
const TOP_N = 500;
const RETENTION_DAYS = 400;

const num = (s) => {
	const n = parseInt(String(s).replace(/[,+]/g, ''), 10);
	return Number.isNaN(n) ? null : n;
};

const decode = (s) =>
	s
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");

export function parseKworb(html) {
	const re =
		/<tr><td[^>]*>(\d+)<\/td><td class="text"><div><a href="artist\/([^_]+)_songs\.html">([^<]*)<\/a><\/div><\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><\/tr>/g;
	const rows = [];
	let m;
	while ((m = re.exec(html))) {
		const listeners = num(m[4]);
		if (listeners === null) continue;
		rows.push({
			rank: num(m[1]),
			id: m[2],
			name: decode(m[3]),
			listeners,
			dailyChange: num(m[5]) ?? 0,
			peak: num(m[6]),
		});
	}
	return rows;
}

async function spotifyToken() {
	const id = process.env.SPOTIFY_CLIENT_ID;
	const secret = process.env.SPOTIFY_CLIENT_SECRET;
	if (!id || !secret) return null;
	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
		},
		body: 'grant_type=client_credentials',
	});
	if (!res.ok) return null;
	return (await res.json()).access_token;
}

async function fetchArtistMeta(ids) {
	const token = await spotifyToken();
	const meta = {};
	if (!token) return meta;
	for (let i = 0; i < ids.length; i += 50) {
		const res = await fetch(
			`https://api.spotify.com/v1/artists?ids=${ids.slice(i, i + 50).join(',')}`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);
		if (!res.ok) continue;
		for (const a of (await res.json()).artists ?? []) {
			if (!a) continue;
			meta[a.id] = {
				image: a.images?.at(-1)?.url ?? null,
				followers: a.followers?.total ?? null,
				popularity: a.popularity ?? null,
			};
		}
	}
	return meta;
}

const dateKey = (d) => d.toISOString().slice(0, 10);

function nearest(keys, target, tolDays) {
	let best = null;
	let bestDiff = Infinity;
	for (const k of keys) {
		const diff = Math.abs(Date.parse(k) - Date.parse(target)) / 86400e3;
		if (diff < bestDiff) {
			best = k;
			bestDiff = diff;
		}
	}
	return bestDiff <= tolDays ? best : null;
}

export async function refresh() {
	const res = await fetch(KWORB_URL, {
		headers: { 'user-agent': 'Mozilla/5.0 (frankieseabrook.com charles dashboard)' },
	});
	if (!res.ok) throw new Error(`kworb fetch failed: ${res.status}`);
	const artists = parseKworb(await res.text()).slice(0, TOP_N);
	if (artists.length < 400) throw new Error(`kworb parse returned only ${artists.length} rows`);

	const store = getStore('top500');
	const today = dateKey(new Date());
	await store.setJSON(
		`snap/${today}`,
		artists.map((a) => ({ id: a.id, rank: a.rank, listeners: a.listeners }))
	);

	const listing = await store.list({ prefix: 'snap/' });
	const keys = listing.blobs
		.map((b) => b.key.slice(5))
		.filter((k) => k < today)
		.sort();

	// [days back, tolerance in days] per movement window
	const windows = { dod: [1, 1], wow: [7, 2], mom: [30, 7] };
	const prev = {};
	for (const [label, [days, tol]] of Object.entries(windows)) {
		const key = nearest(keys, dateKey(new Date(Date.now() - days * 86400e3)), tol);
		prev[label] = key
			? {
					date: key,
					byId: Object.fromEntries(
						(await store.get(`snap/${key}`, { type: 'json' })).map((s) => [s.id, s])
				  ),
			  }
			: null;
	}

	const meta = await fetchArtistMeta(artists.map((a) => a.id));

	const rows = artists.map((a) => {
		const row = { ...a, ...(meta[a.id] ?? { image: null, followers: null, popularity: null }) };
		for (const label of Object.keys(windows)) {
			const p = prev[label]?.byId[a.id];
			row[label] = prev[label]
				? p
					? { rank: p.rank - a.rank, listeners: a.listeners - p.listeners }
					: { entered: true }
				: null;
		}
		return row;
	});

	const total = artists.reduce((s, a) => s + a.listeners, 0);
	const totals = {
		listeners: total,
		dailyChange: artists.reduce((s, a) => s + (a.dailyChange || 0), 0),
	};
	for (const label of Object.keys(windows)) {
		totals[label] = prev[label]
			? total - Object.values(prev[label].byId).reduce((s, p) => s + p.listeners, 0)
			: null;
	}

	for (const k of keys) {
		if ((Date.now() - Date.parse(k)) / 86400e3 > RETENTION_DAYS) await store.delete(`snap/${k}`);
	}

	const payload = {
		generatedAt: new Date().toISOString(),
		compared: {
			dod: prev.dod?.date ?? null,
			wow: prev.wow?.date ?? null,
			mom: prev.mom?.date ?? null,
		},
		totals,
		rows,
	};
	await store.setJSON('latest', payload);
	return payload;
}
