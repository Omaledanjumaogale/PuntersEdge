import type { SchemaObject } from './types';
/** Escape HTML delimiters so user content cannot terminate the head script. */
export function buildPageGraph(schemas: SchemaObject[]): string {
 return JSON.stringify({ '@context': 'https://schema.org', '@graph': schemas }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
