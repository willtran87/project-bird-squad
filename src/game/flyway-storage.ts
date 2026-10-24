import type { FlywayState, PreenBranch } from './flyway-rules';
import { memoryStorageSessionActive, readJournaledJson, writeJournaledJson } from './safe-storage';

/** Ending persistence belongs to the run, even if its optional journal UI never downloads. */
export function persistFlywayEnding(flyway: FlywayState, birds: {id: string; upgraded?: boolean; preenBranch?: PreenBranch}[]): boolean {
  if (!writeJournaledJson('birdsquad.flyway.journal', {flyway, birds})) return false;
  if (!flyway.medals.length || memoryStorageSessionActive()) return true;
  const earned = readJournaledJson('birdsquad.flyway.medals', value => Array.isArray(value)
    ? value.filter(id => typeof id === 'string') : undefined) ?? [];
  return writeJournaledJson('birdsquad.flyway.medals', [...new Set([...earned, ...flyway.medals])]);
}
