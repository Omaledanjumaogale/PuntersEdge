import { redirect } from '@sveltejs/kit';

// Legacy route: accounts now live at /login and /signup.
export const load = () => redirect(308, '/login');
