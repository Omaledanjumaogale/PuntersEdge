/**
 * Pointer-driven 3D tilt. Fine pointers only (no tilt on touch, where it
 * fights scrolling), and disabled under reduced motion or the motion setting.
 */
import type { Action } from 'svelte/action';

export const tilt: Action<HTMLElement, { max?: number; enabled?: boolean } | undefined> = (node, params) => {
	let max = params?.max ?? 5;
	let enabled = params?.enabled ?? true;
	const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	node.classList.add('tilt');

	const active = () => enabled && fine.matches && !reduced.matches;

	function move(e: PointerEvent) {
		if (!active()) return;
		const r = node.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width - 0.5;
		const y = (e.clientY - r.top) / r.height - 0.5;
		node.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`;
		node.style.setProperty('--glow-x', `${(x + 0.5) * 100}%`);
		node.style.setProperty('--glow-y', `${(y + 0.5) * 100}%`);
	}

	function leave() {
		node.style.transform = '';
	}

	node.addEventListener('pointermove', move);
	node.addEventListener('pointerleave', leave);

	return {
		update(p) {
			max = p?.max ?? 5;
			enabled = p?.enabled ?? true;
			if (!enabled) leave();
		},
		destroy() {
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerleave', leave);
		}
	};
};
