export type { SchemaBase as SchemaObject } from '#lib/types/seo.ts';
export interface Breadcrumb { name: string; url: string }
export interface ArticleInput { title: string; description: string; url: string; datePublished: string; dateModified: string; author: string; publisher: string }
export interface FAQ { question: string; answer: string }
