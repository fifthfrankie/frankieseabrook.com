import { getStore } from '@netlify/blobs';

// strong consistency so consecutive refreshes see each other's writes
export const blobStore = () => getStore({ name: 'top500', consistency: 'strong' });

const KWORB_URL = 'https://kworb.net/spotify/listeners.html';
const KWORB_STREAMS_URL = 'https://kworb.net/spotify/artists.html';
const TOP_N = 500;
const RETENTION_DAYS = 400;
const SERIES_DAYS = 90;

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
			peakListeners: num(m[7]),
		});
	}
	return rows;
}

// kworb artists.html: total/daily streams per artist, values in millions
export function parseKworbStreams(html) {
	const re =
		/<td class="text"><div><a href="[^"]*artist\/([^_]+)_songs\.html">[^<]*<\/a><\/div><\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/g;
	const byId = {};
	let m;
	while ((m = re.exec(html))) {
		const streams = parseFloat(m[2].replace(/,/g, ''));
		const daily = parseFloat(m[3].replace(/,/g, ''));
		if (!Number.isFinite(streams)) continue;
		byId[m[1]] = {
			streams: Math.round(streams * 1e6),
			dailyStreams: Number.isFinite(daily) ? Math.round(daily * 1e6) : null,
		};
	}
	return byId;
}

async function spotifyToken() {
	const id = process.env.SPOTIFY_CLIENT_ID;
	const secret = process.env.SPOTIFY_CLIENT_SECRET;
	if (!id || !secret) return { status: 'no-credentials', token: null };
	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
		},
		body: 'grant_type=client_credentials',
	});
	if (!res.ok) return { status: `auth-failed-${res.status}`, token: null };
	return { status: 'ok', token: (await res.json()).access_token };
}

async function fetchArtistMeta(ids) {
	const { status, token } = await spotifyToken();
	const meta = {};
	if (!token) return { meta, status };
	for (let i = 0; i < ids.length; i += 50) {
		const res = await fetch(
			`https://api.spotify.com/v1/artists?ids=${ids.slice(i, i + 50).join(',')}`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);
		if (!res.ok) continue;
		for (const a of (await res.json()).artists ?? []) {
			if (!a) continue;
			meta[a.id] = {
				// images are sorted largest-first; ~320px suits card thumbnails
				image: (a.images?.find((i) => i.width <= 320) ?? a.images?.at(-1))?.url ?? null,
				followers: a.followers?.total ?? null,
				popularity: a.popularity ?? null,
			};
		}
	}
	return { meta, status };
}

// oEmbed is one request per artist, so resolve missing images incrementally
// per refresh to stay inside the sync-function time budget; the cache is
// persistent, so coverage reaches 100% after a few refreshes.
const OEMBED_BATCH = 120;
const OEMBED_CONCURRENCY = 12;

async function resolveImages(store, ids, meta) {
	const cache = (await store.get('images', { type: 'json' })) ?? {};
	for (const [id, m] of Object.entries(meta)) {
		if (m.image) cache[id] = { url: m.image, src: 'api', at: Date.now() };
	}
	const missing = ids
		.filter((id) => !cache[id]?.url)
		.sort(() => Math.random() - 0.5)
		.slice(0, OEMBED_BATCH);
	for (let i = 0; i < missing.length; i += OEMBED_CONCURRENCY) {
		await Promise.all(
			missing.slice(i, i + OEMBED_CONCURRENCY).map(async (id) => {
				try {
					const res = await fetch(
						`https://open.spotify.com/oembed?url=https://open.spotify.com/artist/${id}`
					);
					if (!res.ok) return;
					const url = (await res.json()).thumbnail_url;
					if (url) cache[id] = { url, src: 'oembed', at: Date.now() };
				} catch {}
			})
		);
	}
	await store.setJSON('images', cache);
	return cache;
}

const dateKey = (d) => d.toISOString().slice(0, 10);

// rolling per-artist history: dates[] aligned with totals[] and each
// artists[id].{r,l}; listeners stored in thousands to keep the blob small
async function updateSeries(store, today, artists, total) {
	const s = (await store.get('series', { type: 'json' })) ?? { dates: [], totals: [], artists: {} };
	if (s.dates.at(-1) !== today) {
		s.dates.push(today);
		s.totals.push(null);
		for (const e of Object.values(s.artists)) {
			e.r.push(null);
			e.l.push(null);
		}
	}
	const at = s.dates.length - 1;
	s.totals[at] = Math.round(total / 1000);
	for (const a of artists) {
		if (!s.artists[a.id]) {
			s.artists[a.id] = { r: Array(s.dates.length).fill(null), l: Array(s.dates.length).fill(null) };
		}
		const e = s.artists[a.id];
		e.r[at] = a.rank;
		e.l[at] = Math.round(a.listeners / 1000);
	}
	const cut = s.dates.length - SERIES_DAYS;
	if (cut > 0) {
		s.dates.splice(0, cut);
		s.totals.splice(0, cut);
		for (const e of Object.values(s.artists)) {
			e.r.splice(0, cut);
			e.l.splice(0, cut);
		}
	}
	for (const [id, e] of Object.entries(s.artists)) {
		if (!e.l.some((v) => v !== null)) delete s.artists[id];
	}
	await store.setJSON('series', s);
}

// [days back, tolerance, min fallback age] per movement window;
// null fallback age = strict (dod vs stale data would be mislabeled)
export const WINDOWS = { dod: [1, 1, null], wow: [7, 2, 3], mom: [30, 7, 14] };

// prefer a snapshot near the exact window; otherwise compare against the
// oldest snapshot once history spans at least minAge days, so measures
// activate early (the compared date is surfaced in the payload and UI)
export function resolveWindowKey(keys, today, days, tol, minAge) {
	const target = dateKey(new Date(Date.parse(today) - days * 86400e3));
	let key = nearest(keys, target, tol);
	if (!key && keys.length && minAge !== null) {
		const oldest = keys[0];
		if ((Date.parse(today) - Date.parse(oldest)) / 86400e3 >= minAge) key = oldest;
	}
	return key;
}

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
	const ua = { headers: { 'user-agent': 'Mozilla/5.0 (frankieseabrook.com charles dashboard)' } };
	const [res, streamsRes] = await Promise.all([
		fetch(KWORB_URL, ua),
		fetch(KWORB_STREAMS_URL, ua).catch(() => null),
	]);
	if (!res.ok) throw new Error(`kworb fetch failed: ${res.status}`);
	const artists = parseKworb(await res.text()).slice(0, TOP_N);
	const streamsById = streamsRes?.ok ? parseKworbStreams(await streamsRes.text()) : {};
	if (artists.length < 400) throw new Error(`kworb parse returned only ${artists.length} rows`);

	const store = blobStore();
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

	const prev = {};
	for (const [label, [days, tol, minAge]] of Object.entries(WINDOWS)) {
		const key = resolveWindowKey(keys, today, days, tol, minAge);
		prev[label] = key
			? {
					date: key,
					byId: Object.fromEntries(
						(await store.get(`snap/${key}`, { type: 'json' })).map((s) => [s.id, s])
				  ),
			  }
			: null;
	}

	const { meta, status: spotifyStatus } = await fetchArtistMeta(artists.map((a) => a.id));
	const images = await resolveImages(store, artists.map((a) => a.id), meta);

	const rows = artists.map((a) => {
		const m = meta[a.id];
		const row = {
			...a,
			...(streamsById[a.id] ?? { streams: null, dailyStreams: null }),
			image: m?.image ?? images[a.id]?.url ?? null,
			followers: m?.followers ?? null,
			popularity: m?.popularity ?? null,
		};
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

	await updateSeries(store, today, artists, total);

	for (const k of keys) {
		if ((Date.now() - Date.parse(k)) / 86400e3 > RETENTION_DAYS) await store.delete(`snap/${k}`);
	}

	const payload = {
		generatedAt: new Date().toISOString(),
		spotify: spotifyStatus,
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
