import 'dotenv/config';
import { runFetch } from './services/fetcher.js';
await runFetch({ mode: 'seed' });
console.log('seed complete');
