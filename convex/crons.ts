import {cronJobs} from 'convex/server';
// Heavy ingestion runs in .github/workflows/sports-ingest.yml, keeping blob traffic off Convex.
const crons=cronJobs();
export default crons;
