import type { PageServerLoad } from './$types';
import { buildMeta } from '#lib/seo.ts';
import { buildOrganizationSchema, buildWebSiteSchema, buildProductSchema } from '#lib/schema/builders.ts';
export const load: PageServerLoad = ({url}) => {
 const origin = import.meta.env.PUBLIC_SITE_URL || url.origin;
 return {seo:buildMeta({title:'All-access membership — PuntersEdge',description:'One calendar month of PuntersEdge live sports feeds and backend AI explanations for ₦10,000. Renew manually through hosted checkout.',canonical:`${origin}/subscribe`,schemas:[buildOrganizationSchema(origin),buildWebSiteSchema(origin),buildProductSchema({name:'PuntersEdge monthly all-access membership',description:'One calendar month of live feeds and backend AI explanations; manual renewal.',url:`${origin}/subscribe`,price:10000,currency:'NGN'})]})};
};
