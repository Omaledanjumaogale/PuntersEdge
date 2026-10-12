/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_reasoning from "../ai_reasoning.js";
import type * as auth from "../auth.js";
import type * as betslip from "../betslip.js";
import type * as crons from "../crons.js";
import type * as feed from "../feed.js";
import type * as fixtures from "../fixtures.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai_reasoning: typeof ai_reasoning;
  auth: typeof auth;
  betslip: typeof betslip;
  crons: typeof crons;
  feed: typeof feed;
  fixtures: typeof fixtures;
  http: typeof http;
  ingest: typeof ingest;
  users: typeof users;
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

export declare const components: {};
