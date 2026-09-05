export function todayFilenameStamp() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
export function countRows(backup) {
    return Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0);
}
//# sourceMappingURL=backup-summary.js.map