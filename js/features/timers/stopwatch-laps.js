// Pure logic for the sports Stopwatch's lap/split table — deliberately
// DOM-free (stopwatch-view.ts is the only thing that touches the
// document), same "pure logic lives outside the view" convention as
// sleep-score.ts/sleep-hypnogram.ts and the rest of this codebase.
//
// A real sports stopwatch (a Casio, an Apple Watch) tracks two numbers
// per lap from one button: the *lap* time (how long since the previous
// lap) and the *split* time (cumulative time since Start) — never a
// third, separate "split" button, since a lap tap always produces both.
/** Centisecond precision — real elapsed time, not a fabricated extra
 *  digit. formatDuration in timer.js already floors to whole seconds for
 *  the Rest Timer's own countdown display, deliberately coarser than a
 *  sports stopwatch needs; this is that same wall-clock-elapsed-ms number,
 *  just formatted for a tool where hundredths genuinely matter. */
export function formatStopwatchTime(ms) {
    const totalCentiseconds = Math.max(0, Math.floor(ms / 10));
    const centiseconds = totalCentiseconds % 100;
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    const pad2 = (n) => String(n).padStart(2, '0');
    const time = hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
    return `${time}.${pad2(centiseconds)}`;
}
/** Builds the next lap record from the stopwatch's current total elapsed
 *  time and whatever the previous lap's own split was (0 for the first
 *  lap) — the view just needs to pass its own already-tracked history,
 *  no I/O or timing happens here. */
export function buildLapRecord(lapNumber, previousSplitMs, currentElapsedMs) {
    return {
        lapNumber,
        lapMs: Math.max(0, currentElapsedMs - previousSplitMs),
        splitMs: currentElapsedMs,
    };
}
// Highlighting "fastest"/"slowest" from just one or two laps is a
// fabricated insight — with two laps, whichever is shorter is trivially
// both "fastest" and "the only other one", not a real comparison. Three
// real laps is the honest floor for that to mean anything, the same
// "don't claim a pattern from too little data" instinct as the cycle
// tracker's own sparse-history handling.
const MIN_LAPS_FOR_HIGHLIGHT = 3;
/** Real fastest/slowest laps by lap time (never split time — a later lap
 *  always has a bigger split just from accumulating earlier ones, that's
 *  not "slower"). Ties resolve to the earliest lap, same as any other
 *  "first real one wins" tie-break in this app. */
export function classifyLaps(laps) {
    if (laps.length < MIN_LAPS_FOR_HIGHLIGHT)
        return { fastestLapNumber: null, slowestLapNumber: null };
    let fastest = laps[0];
    let slowest = laps[0];
    for (const lap of laps) {
        if (lap.lapMs < fastest.lapMs)
            fastest = lap;
        if (lap.lapMs > slowest.lapMs)
            slowest = lap;
    }
    // All laps identical — nothing real to call out either way.
    if (fastest.lapMs === slowest.lapMs)
        return { fastestLapNumber: null, slowestLapNumber: null };
    return { fastestLapNumber: fastest.lapNumber, slowestLapNumber: slowest.lapNumber };
}
//# sourceMappingURL=stopwatch-laps.js.map