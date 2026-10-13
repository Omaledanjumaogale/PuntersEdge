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
import type * as feed from "../feed.js";
import type * as fixtures from "../fixtures.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_flutterwave from "../lib/flutterwave.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as performance from "../performance.js";
import type * as performanceArchive from "../performanceArchive.js";
import type * as push from "../push.js";
import type * as pushValidation from "../pushValidation.js";
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
  feed: typeof feed;
  fixtures: typeof fixtures;
  http: typeof http;
  ingest: typeof ingest;
  "lib/billing": typeof lib_billing;
  "lib/flutterwave": typeof lib_flutterwave;
  notifications: typeof notifications;
  payments: typeof payments;
  performance: typeof performance;
  performanceArchive: typeof performanceArchive;
  push: typeof push;
  pushValidation: typeof pushValidation;
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
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
