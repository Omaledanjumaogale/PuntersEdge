import {cronJobs,anyApi} from 'convex/server';
// Heavy ingestion runs in .github/workflows/sports-ingest.yml, keeping blob traffic off Convex.
const crons=cronJobs();
crons.daily('bounded retention and payment monitor',{hourUTC:3,minuteUTC:20},anyApi.maintenance.retention,{});
export default crons;
