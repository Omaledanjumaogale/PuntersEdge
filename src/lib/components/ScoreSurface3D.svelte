<script lang="ts">
	/**
	 * 3D score-distribution surface. One tower per exact scoreline; height is
	 * its Dixon–Coles probability. Three.js is loaded lazily so it never
	 * blocks first paint, and the scene pauses when off-screen or hidden.
	 */
	import { onMount } from 'svelte';
	import { app } from '#lib/state.svelte.ts';

	interface Props {
		matrix: number[][];
		homeTeam: string;
		awayTeam: string;
		height?: number;
		autoRotate?: boolean;
		onhover?: (cell: { home: number; away: number; prob: number } | null) => void;
	}

	let { matrix, homeTeam, awayTeam, height = 320, autoRotate = true, onhover }: Props = $props();

	let host: HTMLDivElement;
	let failed = $state(false);
	let ready = $state(false);
	let hovered = $state<{ home: number; away: number; prob: number } | null>(null);

	const size = $derived(Math.min(matrix.length, 6));
	const maxProb = $derived(Math.max(...matrix.slice(0, size).flatMap((r) => r.slice(0, size))));

	onMount(() => {
		let disposed = false;
		let cleanup = () => {};

		(async () => {
			let THREE: typeof import('three');
			try {
				THREE = await import('three');
			} catch {
				failed = true;
				return;
			}
			if (disposed) return;

			const canvasTest = document.createElement('canvas');
			if (!canvasTest.getContext('webgl2') && !canvasTest.getContext('webgl')) {
				failed = true;
				return;
			}

			const token = (name: string, fallback: string) =>
				getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
			const C = {
				line: token('--color-line', '#343d7a'),
				model: token('--color-model', '#3de8c9'),
				deep: token('--color-deep', '#141a3d'),
				haze: token('--color-haze', '#b7bde3')
			};
			const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !app.settings.motion;
			const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.outputColorSpace = THREE.SRGBColorSpace;
			host.appendChild(renderer.domElement);
			renderer.domElement.style.display = 'block';

			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

			scene.add(new THREE.AmbientLight(0x8d93b8, 0.9));
			const key = new THREE.DirectionalLight(0xffffff, 1.6);
			key.position.set(4, 9, 6);
			scene.add(key);
			const rim = new THREE.PointLight(new THREE.Color(C.model), 18, 20);
			rim.position.set(-4, 3, -4);
			scene.add(rim);

			const n = size;
			const spacing = 1.1;
			const offset = ((n - 1) * spacing) / 2;
			const H = 3.2;

			const group = new THREE.Group();
			scene.add(group);

			// Pitch floor with chalk grid.
			const floor = new THREE.Mesh(
				new THREE.PlaneGeometry(n * spacing + 1.2, n * spacing + 1.2),
				new THREE.MeshStandardMaterial({ color: new THREE.Color(C.deep), roughness: 0.95 })
			);
			floor.rotation.x = -Math.PI / 2;
			floor.position.y = -0.01;
			group.add(floor);
			const grid = new THREE.GridHelper(n * spacing, n, new THREE.Color(C.line), new THREE.Color(C.line));
			grid.position.y = 0.001;
			group.add(grid);

			const low = new THREE.Color(C.line);
			const high = new THREE.Color(C.model);
			const geom = new THREE.BoxGeometry(0.78, 1, 0.78);
			geom.translate(0, 0.5, 0);

			type Bar = { mesh: import('three').Mesh; target: number; home: number; away: number; prob: number };
			const bars: Bar[] = [];
			for (let h = 0; h < n; h++) {
				for (let a = 0; a < n; a++) {
					const prob = matrix[h][a];
					const t = Math.pow(prob / maxProb, 0.8);
					const color = low.clone().lerp(high, t);
					const mat = new THREE.MeshStandardMaterial({
						color,
						roughness: 0.35,
						metalness: 0.15,
						emissive: color,
						emissiveIntensity: 0.12 + t * 0.35
					});
					const mesh = new THREE.Mesh(geom, mat);
					// rows run toward the viewer (home goals), columns across (away goals)
					mesh.position.set(a * spacing - offset, 0, h * spacing - offset);
					mesh.scale.y = reduced ? Math.max(0.02, (prob / maxProb) * H) : 0.001;
					mesh.userData = { h, a, prob };
					group.add(mesh);
					bars.push({ mesh, target: Math.max(0.02, (prob / maxProb) * H), home: h, away: a, prob });
				}
			}

			// Axis numerals as sprites.
			const label = (text: string, color: string, scale = 0.55) => {
				const c = document.createElement('canvas');
				c.width = 256;
				c.height = 128;
				const ctx = c.getContext('2d')!;
				ctx.fillStyle = color;
				ctx.font = '600 72px "Instrument Sans Variable", system-ui, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(text, 128, 64);
				const tex = new THREE.CanvasTexture(c);
				tex.colorSpace = THREE.SRGBColorSpace;
				const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
				sprite.scale.set(scale * 2, scale, 1);
				return sprite;
			};
			for (let i = 0; i < n; i++) {
				// Numerals sit on the two edges facing the camera so towers never hide them.
				const away = label(String(i), C.haze);
				away.position.set(i * spacing - offset, 0.05, offset + 1.0);
				group.add(away);
				const home = label(String(i), C.haze);
				home.position.set(offset + 1.0, 0.05, i * spacing - offset);
				group.add(home);
			}

			const raycaster = new THREE.Raycaster();
			const pointer = new THREE.Vector2(9, 9);
			let parallaxX = 0, parallaxY = 0;

			const onMove = (e: PointerEvent) => {
				const r = renderer.domElement.getBoundingClientRect();
				pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
				pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
				parallaxX = pointer.x;
				parallaxY = pointer.y;
			};
			const onLeave = () => {
				pointer.set(9, 9);
				parallaxX = parallaxY = 0;
			};
			renderer.domElement.addEventListener('pointermove', onMove);
			renderer.domElement.addEventListener('pointerleave', onLeave);
			renderer.domElement.addEventListener('pointerdown', onMove);

			const resize = () => {
				const w = host.clientWidth;
				renderer.setSize(w, height, false);
				renderer.domElement.style.width = '100%';
				renderer.domElement.style.height = `${height}px`;
				camera.aspect = w / height;
				// Pull the camera back on narrow screens so the whole grid fits.
				const aspect = w / height;
				const dist = aspect < 1.4 ? 14 : 12.5;
				camera.position.set(dist * 0.62, dist * 0.6, dist * 0.78);
				camera.lookAt(0, 0.3, 0);
				camera.updateProjectionMatrix();
			};
			const ro = new ResizeObserver(resize);
			ro.observe(host);
			resize();

			let visible = true;
			const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
			io.observe(host);

			let frame = 0;
			let raf = 0;
			const start = performance.now();
			let lastHover: Bar | null = null;

			const tick = (now: number) => {
				raf = requestAnimationFrame(tick);
				if (!visible || document.hidden) return;
				frame++;
				const t = (now - start) / 1000;

				// Grow-in: staggered by distance from the most likely score.
				if (!reduced) {
					for (const b of bars) {
						const delay = (b.home + b.away) * 0.05;
						const k = Math.min(1, Math.max(0, (t - delay) / 0.9));
						const eased = 1 - Math.pow(1 - k, 4);
						b.mesh.scale.y = Math.max(0.001, b.target * eased);
					}
				}

				const sway = reduced || !autoRotate ? 0 : Math.sin(t * 0.25) * 0.32;
				group.rotation.y += (sway + parallaxX * 0.25 - group.rotation.y) * 0.06;
				group.rotation.x += (-parallaxY * 0.06 - group.rotation.x) * 0.06;

				if (frame % 3 === 0) {
					raycaster.setFromCamera(pointer, camera);
					const hit = raycaster.intersectObjects(bars.map((b) => b.mesh))[0];
					const bar = hit ? bars.find((b) => b.mesh === hit.object) ?? null : null;
					if (bar !== lastHover) {
						if (lastHover) (lastHover.mesh.material as import('three').MeshStandardMaterial).emissiveIntensity -= 0.5;
						if (bar) (bar.mesh.material as import('three').MeshStandardMaterial).emissiveIntensity += 0.5;
						lastHover = bar;
						hovered = bar ? { home: bar.home, away: bar.away, prob: bar.prob } : null;
						onhover?.(hovered);
					}
				}

				renderer.render(scene, camera);
			};
			raf = requestAnimationFrame(tick);
			ready = true;

			cleanup = () => {
				cancelAnimationFrame(raf);
				ro.disconnect();
				io.disconnect();
				renderer.domElement.removeEventListener('pointermove', onMove);
				renderer.domElement.removeEventListener('pointerleave', onLeave);
				renderer.domElement.removeEventListener('pointerdown', onMove);
				scene.traverse((o) => {
					const m = o as import('three').Mesh;
					m.geometry?.dispose();
					const mat = m.material as import('three').Material | import('three').Material[] | undefined;
					if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
					else if (mat) {
						(mat as import('three').SpriteMaterial).map?.dispose();
						mat.dispose();
					}
				});
				renderer.dispose();
				renderer.domElement.remove();
			};
		})();

		return () => {
			disposed = true;
			cleanup();
		};
	});
</script>

<div
	class="relative w-full select-none"
	style="height: {height}px"
	role="img"
	aria-label="3D score distribution for {homeTeam} vs {awayTeam}. Most likely score shown below."
>
	<div bind:this={host} class="absolute inset-0 touch-pan-y"></div>

	{#if failed}
		<!-- WebGL unavailable: flat heat grid with the same encoding -->
		<div class="absolute inset-0 grid place-items-center">
			<div class="grid gap-1" style="grid-template-columns: repeat({size}, minmax(0, 2.4rem))">
				{#each matrix.slice(0, size) as row, h}
					{#each row.slice(0, size) as p, a}
						<div
							class="grid aspect-square place-items-center rounded-md text-[10px] text-ink"
							style="background: color-mix(in oklab, var(--color-model) {Math.round((p / maxProb) * 100)}%, var(--color-line))"
							title="{h}–{a}: {(p * 100).toFixed(1)}%"
						>
							{h}–{a}
						</div>
					{/each}
				{/each}
			</div>
		</div>
	{:else if !ready}
		<div class="absolute inset-0 grid place-items-center text-sm text-haze">Building the score surface…</div>
	{/if}

	<div class="pointer-events-none absolute left-3 top-3 rounded-full bg-deep/80 px-2.5 py-1 text-xs font-medium text-haze backdrop-blur">
		Rows: <span class="fixture-name">{homeTeam}</span> goals. Columns: <span class="fixture-name">{awayTeam}</span> goals.
	</div>
	{#if hovered}
		<div class="pointer-events-none absolute right-3 top-10 rounded-full bg-deep/90 px-3 py-1 text-sm text-chalk ring-1 ring-line backdrop-blur sm:top-3">
			<span class="font-display font-semibold">{hovered.home}–{hovered.away}</span>
			<span class="ml-1.5 text-model">{(hovered.prob * 100).toFixed(1)}%</span>
		</div>
	{/if}
</div>
