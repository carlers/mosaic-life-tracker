import { useSyncExternalStore } from 'react';
import {
  getDatabaseBootstrapSnapshot,
  subscribeToDatabaseBootstrap,
} from '../lib/databaseBootstrap';

export function useDatabaseBootstrap() {
  return useSyncExternalStore(
    subscribeToDatabaseBootstrap,
    getDatabaseBootstrapSnapshot,
    getDatabaseBootstrapSnapshot
  );
}
