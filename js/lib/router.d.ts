// Hand-written type contract for router.js (a plain, hand-written JS module
// that stays untouched — see tsconfig.json for why this file exists).

export function initRouter(root?: ParentNode): void;
export function onScreenShown(id: string, callback: () => void): void;
export function showScreen(id: string, options?: { focus?: boolean }): void;
export function getCurrentScreenId(): string | null;
