import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initRouter, showScreen, getCurrentScreenId, onScreenShown, onScreenHidden, onAnyScreenChange } from '../../../js/lib/router.js';

// router.js's own DOM surface is tiny (querySelectorAll('.screen'), plus
// .id/.hidden/.setAttribute/.focus per element) — a hand-rolled fake
// root is enough to exercise it for real without pulling in jsdom just
// for this one module.
function fakeScreen(id, hidden) {
  return {
    id,
    hidden,
    setAttribute: vi.fn(),
    focus: vi.fn(),
  };
}

function fakeRoot(screens) {
  return { querySelectorAll: () => screens };
}

function setUpScreens(ids, initiallyVisibleId) {
  const screens = ids.map((id) => fakeScreen(id, id !== initiallyVisibleId));
  initRouter(fakeRoot(screens));
  return screens;
}

describe('showScreen / getCurrentScreenId', () => {
  it('starts on whichever screen the static markup left visible', () => {
    setUpScreens(['screen-a', 'screen-b'], 'screen-a');
    expect(getCurrentScreenId()).toBe('screen-a');
  });

  it('hides every other screen and shows only the requested one', () => {
    const [a, b, c] = setUpScreens(['screen-a', 'screen-b', 'screen-c'], 'screen-a');
    showScreen('screen-b', { focus: false });
    expect(a.hidden).toBe(true);
    expect(b.hidden).toBe(false);
    expect(c.hidden).toBe(true);
    expect(getCurrentScreenId()).toBe('screen-b');
  });

  it('throws for an unregistered screen id, rather than silently no-op-ing', () => {
    setUpScreens(['screen-a'], 'screen-a');
    expect(() => showScreen('screen-nope')).toThrow(/screen-nope/);
  });
});

describe('onScreenShown / onScreenHidden', () => {
  it('fires the shown callback only for the screen it was registered on', () => {
    setUpScreens(['screen-a', 'screen-b'], 'screen-a');
    const shownA = vi.fn();
    const shownB = vi.fn();
    onScreenShown('screen-a', shownA);
    onScreenShown('screen-b', shownB);

    showScreen('screen-b', { focus: false });
    expect(shownA).not.toHaveBeenCalled();
    expect(shownB).toHaveBeenCalledTimes(1);
  });

  it('fires the hidden callback for the screen navigated away from', () => {
    setUpScreens(['screen-a', 'screen-b'], 'screen-a');
    const hiddenA = vi.fn();
    onScreenHidden('screen-a', hiddenA);

    showScreen('screen-b', { focus: false });
    expect(hiddenA).toHaveBeenCalledTimes(1);
  });

  it('never fires a hidden callback on the very first navigation into that screen', () => {
    setUpScreens(['screen-a', 'screen-b'], 'screen-a');
    const hiddenB = vi.fn();
    onScreenHidden('screen-b', hiddenB);

    showScreen('screen-b', { focus: false }); // b was never current before, so nothing was "hidden" to get here
    expect(hiddenB).not.toHaveBeenCalled();
  });
});

describe('onAnyScreenChange', () => {
  it('fires with the new screen id on every real navigation', () => {
    setUpScreens(['screen-a', 'screen-b', 'screen-c'], 'screen-a');
    const spy = vi.fn();
    onAnyScreenChange(spy);

    showScreen('screen-b', { focus: false });
    showScreen('screen-c', { focus: false });
    expect(spy.mock.calls).toEqual([['screen-b'], ['screen-c']]);
  });

  it('fires for every registered listener, not just one', () => {
    setUpScreens(['screen-a', 'screen-b'], 'screen-a');
    const spyOne = vi.fn();
    const spyTwo = vi.fn();
    onAnyScreenChange(spyOne);
    onAnyScreenChange(spyTwo);

    showScreen('screen-b', { focus: false });
    expect(spyOne).toHaveBeenCalledWith('screen-b');
    expect(spyTwo).toHaveBeenCalledWith('screen-b');
  });
});
