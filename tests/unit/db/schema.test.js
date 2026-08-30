import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';

describe('schema', () => {
  it('declares every store the current build phase needs', async () => {
    const db = createDb('schema-test');
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      [
        'categoryAssignments',
        'cycleLogs',
        'exercises',
        'injuryScreens',
        'profile',
        'heartRateSamples',
        'nutritionEntries',
        'programs',
        'runs',
        'sessions',
        'sets',
        'settings',
      ].sort()
    );
    db.close();
  });

  it('a boolean value on an indexed field stores fine but is unfindable by string queries', async () => {
    // Booleans are not a valid IndexedDB key type — writing one to an
    // indexed field doesn't throw (the record itself is stored intact),
    // it just silently fails to appear through that index, which is a
    // much sneakier bug than an error would be. This is exactly why
    // `status` is a string enum ('draft'/'active'/'archived') and not
    // an `active: true/false` flag.
    const db = createDb('schema-bool-test');
    await db.open();
    await db.programs.add({ id: 'p1', category: 'endurance', status: true });

    expect(await db.programs.get('p1')).toBeTruthy(); // the record itself is fine
    expect(await db.programs.where('status').equals('active').toArray()).toEqual([]); // but not findable this way
    db.close();
  });
});

describe('two independent createDb() instances', () => {
  let dbA, dbB;

  beforeEach(() => {
    dbA = createDb('isolation-test-a');
    dbB = createDb('isolation-test-b');
  });

  it('do not see each other\'s data', async () => {
    await dbA.profile.put({ id: 'primary', displayName: 'A' });
    const fromB = await dbB.profile.get('primary');
    expect(fromB).toBeUndefined();
  });
});
