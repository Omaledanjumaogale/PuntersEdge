/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as admin from "../admin.js";
import type * as ai_insights from "../ai_insights.js";
import type * as ai_reasoning from "../ai_reasoning.js";
import type * as ai_usage from "../ai_usage.js";
import type * as auth from "../auth.js";
import type * as betslip from "../betslip.js";
import type * as crons from "../crons.js";
import type * as evidence from "../evidence.js";
import type * as feed from "../feed.js";
import type * as fixtures from "../fixtures.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as learning from "../learning.js";
import type * as lib_accountEvents from "../lib/accountEvents.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_flutterwave from "../lib/flutterwave.js";
import type * as lib_paymentSecurity from "../lib/paymentSecurity.js";
import type * as lib_paymentValidators from "../lib/paymentValidators.js";
import type * as maintenance from "../maintenance.js";
import type * as models from "../models.js";
import type * as notifications from "../notifications.js";
import type * as paymentOps from "../paymentOps.js";
import type * as payments from "../payments.js";
import type * as performance from "../performance.js";
import type * as performanceArchive from "../performanceArchive.js";
import type * as privacy from "../privacy.js";
import type * as push from "../push.js";
import type * as pushValidation from "../pushValidation.js";
import type * as rollover from "../rollover.js";
import type * as slipEvidence from "../slipEvidence.js";
import type * as tennisSchedule from "../tennisSchedule.js";
import type * as tennisShadow from "../tennisShadow.js";
import type * as testers from "../testers.js";
import type * as ticketRules from "../ticketRules.js";
import type * as trainingData from "../trainingData.js";
import type * as users from "../users.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  admin: typeof admin;
  ai_insights: typeof ai_insights;
  ai_reasoning: typeof ai_reasoning;
  ai_usage: typeof ai_usage;
  auth: typeof auth;
  betslip: typeof betslip;
  crons: typeof crons;
  evidence: typeof evidence;
  feed: typeof feed;
  fixtures: typeof fixtures;
  http: typeof http;
  ingest: typeof ingest;
  learning: typeof learning;
  "lib/accountEvents": typeof lib_accountEvents;
  "lib/billing": typeof lib_billing;
  "lib/entitlements": typeof lib_entitlements;
  "lib/flutterwave": typeof lib_flutterwave;
  "lib/paymentSecurity": typeof lib_paymentSecurity;
  "lib/paymentValidators": typeof lib_paymentValidators;
  maintenance: typeof maintenance;
  models: typeof models;
  notifications: typeof notifications;
  paymentOps: typeof paymentOps;
  payments: typeof payments;
  performance: typeof performance;
  performanceArchive: typeof performanceArchive;
  privacy: typeof privacy;
  push: typeof push;
  pushValidation: typeof pushValidation;
  rollover: typeof rollover;
  slipEvidence: typeof slipEvidence;
  tennisSchedule: typeof tennisSchedule;
  tennisShadow: typeof tennisShadow;
  testers: typeof testers;
  ticketRules: typeof ticketRules;
  trainingData: typeof trainingData;
  users: typeof users;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
