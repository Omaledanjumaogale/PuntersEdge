export interface SchemaBase { '@type': string; '@id'?: string; [key: string]: unknown }
export interface OpenGraphMeta { title: string; description: string; url: string; type: 'website' | 'article'; image?: string; locale: string }
export interface TwitterMeta { card: 'summary' | 'summary_large_image'; title: string; description: string; image?: string }
export interface PageSEO { title: string; description: string; canonical: string; robots?: string; image?: string; type?: 'website' | 'article'; schemas?: SchemaBase[]; datePublished?: string; dateModified?: string }
export interface SEOConfig extends PageSEO { robots: string; openGraph: OpenGraphMeta; twitter: TwitterMeta; jsonLd: string }
