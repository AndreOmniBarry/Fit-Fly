import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  createProgram,
  getActiveProgram,
  getProgram,
  listProgramsByCategory,
  PROGRAM_STATUS,
  setProgramStatus,
} from '../../../js/db/repositories/programs.js';

describe('programs repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`programs-test-${Math.random()}`);
  });

  it('defaults a new program to draft status with a generated id', async () => {
    const program = await createProgram({ category: 'hypertrophy', name: 'Block 1' }, db);
    expect(program.status).toBe(PROGRAM_STATUS.DRAFT);
    expect(program.id).toBeTruthy();
    expect(await getProgram(program.id, db)).toEqual(program);
  });

  it('activating a program makes it findable as the active program for its category', async () => {
    const program = await createProgram({ category: 'endurance', name: 'Base Building' }, db);
    expect(await getActiveProgram('endurance', db)).toBeUndefined();

    await setProgramStatus(program.id, PROGRAM_STATUS.ACTIVE, db);

    const active = await getActiveProgram('endurance', db);
    expect(active.id).toBe(program.id);
  });

  it('archiving clears it from getActiveProgram', async () => {
    const program = await createProgram({ category: 'endurance', name: 'Base Building' }, db);
    await setProgramStatus(program.id, PROGRAM_STATUS.ACTIVE, db);
    await setProgramStatus(program.id, PROGRAM_STATUS.ARCHIVED, db);

    expect(await getActiveProgram('endurance', db)).toBeUndefined();
  });

  it('lists every program for a category regardless of status', async () => {
    await createProgram({ category: 'recomposition', name: 'A' }, db);
    await createProgram({ category: 'recomposition', name: 'B' }, db);
    await createProgram({ category: 'hypertrophy', name: 'C' }, db);

    expect(await listProgramsByCategory('recomposition', db)).toHaveLength(2);
  });
});
