import {v} from 'convex/values';
export const bankTransferValidator=v.object({kind:v.literal('bankTransfer'),reference:v.string(),amount:v.number(),currency:v.literal('NGN'),accountNumber:v.string(),bankName:v.string(),accountName:v.string(),expiresAt:v.string()});
