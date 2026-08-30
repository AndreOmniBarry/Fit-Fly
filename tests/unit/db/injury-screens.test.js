import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  listInjuryScreens,
  listInjuryScreensForArea,
  listOpenRedFlags,
  recordInjuryScreen,
} from '../../../js/db/repositories/injury-screens.js';

describe('injury-screens repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`injury-test-${Math.random()}`);
  });

  it('lists screens newest first', async () => {
    await recordInjuryScreen({ bodyArea: 'lower-back', severity: 2 }, db);
    await recordInjuryScreen({ bodyArea: 'knee', severity: 1 }, db);

    const screens = await listInjuryScreens(db);
    expect(screens.map((s) => s.bodyArea)).toEqual(['knee', 'lower-back']);
  });

  it('filters by body area', async () => {
    await recordInjuryScreen({ bodyArea: 'lower-back', severity: 2 }, db);
    await recordInjuryScreen({ bodyArea: 'knee', severity: 1 }, db);

    const knee = await listInjuryScreensForArea('knee', db);
    expect(knee).toHaveLength(1);
    expect(knee[0].bodyArea).toBe('knee');
  });

  it('defaults redFlags to an empty array and notes to an empty string', async () => {
    const entry = await recordInjuryScreen({ bodyArea: 'shoulder', severity: 1 }, db);
    expect(entry.redFlags).toEqual([]);
    expect(entry.notes).toBe('');
  });

  it('surfaces only screens that raised a red flag', async () => {
    await recordInjuryScreen({ bodyArea: 'lower-back', severity: 3, redFlags: ['numbness'] }, db);
    await recordInjuryScreen({ bodyArea: 'knee', severity: 1 }, db);

    const flagged = await listOpenRedFlags(db);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].bodyArea).toBe('lower-back');
  });
});
