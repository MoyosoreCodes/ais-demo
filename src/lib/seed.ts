// Assembles the seed Database from the /src/data JSON files.
// freshDb() returns a deep clone so the running app never mutates the seed constants.
import audit from '../data/audit.json';
import clients from '../data/clients.json';
import documents from '../data/documents.json';
import farms from '../data/farms.json';
import inspections from '../data/inspections.json';
import livestockVisits from '../data/livestockVisits.json';
import loans from '../data/loans.json';
import notifications from '../data/notifications.json';
import samples from '../data/samples.json';
import stalls from '../data/stalls.json';
import surveillanceCases from '../data/surveillanceCases.json';
import users from '../data/users.json';
import vendors from '../data/vendors.json';
import workflows from '../data/workflows.json';
import type { Database } from './types';

const SEED = {
  users,
  clients,
  farms,
  loans,
  samples,
  livestockVisits,
  surveillanceCases,
  vendors,
  stalls,
  inspections,
  documents,
  notifications,
  workflows,
  audit,
} as unknown as Database;

export function freshDb(): Database {
  return structuredClone(SEED);
}
