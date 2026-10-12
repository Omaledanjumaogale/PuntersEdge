import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Live data: every 30 minutes. Each tick only calls providers whose jobs are
// due and within quota (see src/lib/feeds/budget.ts and jobs.js).
crons.interval("ingest live feeds", { minutes: 30 }, internal.ingest.tick, {});

export default crons;
