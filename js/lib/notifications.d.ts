// Sidecar types for notifications.js (hand-written JS, untouched — see
// tsconfig.json).
export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function isNotificationSupported(): boolean;
export function getNotificationPermission(): NotificationPermissionState;
export function requestNotificationPermission(): Promise<NotificationPermissionState>;
export function showNotification(title: string, options?: NotificationOptions): boolean;
