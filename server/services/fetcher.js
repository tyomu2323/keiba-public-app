import { db, nowIso } from '../db.js';
import * as sample from './sample-source.js';
import * as jravan from './jravan-adapter.js';

export async function runFetch(params) {
  const source = process.env.DATA_SOURCE === 'jravan' ? jravan : sample;
  try {
    const result = await source.fetchData(params);
    db.prepare('INSERT INTO fetch_logs (mode,status,message,created_at) VALUES (?,?,?,?)')
      .run(params.mode || 'manual', 'ok', result.message || JSON.stringify(result), nowIso());
    return result;
  } catch (e) {
    db.prepare('INSERT INTO fetch_logs (mode,status,message,created_at) VALUES (?,?,?,?)')
      .run(params.mode || 'manual', 'error', e.message, nowIso());
    throw e;
  }
}
