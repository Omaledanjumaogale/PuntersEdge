import { redirect } from '@sveltejs/kit';

// Accounts aren't enabled yet; preferences live on the device.
export const load = () => redirect(308, '/settings');
