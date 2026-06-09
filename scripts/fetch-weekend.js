import 'dotenv/config';
import '../server/db.js';
import { runFetch } from '../server/services/fetcher.js';
await runFetch({ mode: 'weekend', target: 'all-races' });
console.log('weekend fetch complete');
