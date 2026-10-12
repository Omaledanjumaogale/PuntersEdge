import { error } from '@sveltejs/kit';
import { FOOTBALL_INPUTS, BASKETBALL_INPUTS } from '#lib/data/fixtures.js';
import type { EntryGenerator, PageLoad } from './$types';

const ids = [...FOOTBALL_INPUTS, ...BASKETBALL_INPUTS].map((f) => f.fixtureId);

// Prerender a page per fixture so every match works offline and on static hosting.
export const entries: EntryGenerator = () => ids.map((id) => ({ id }));

export const load: PageLoad = ({ params }) => {
	if (!ids.includes(params.id)) error(404, 'That fixture is no longer on the board.');
	return { id: params.id };
};
