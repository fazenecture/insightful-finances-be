"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSeconds = formatSeconds;
exports.formatDurationRange = formatDurationRange;
function formatSeconds(seconds) {
    if (seconds < 60) {
        return { value: seconds, unit: "sec" };
    }
    const minutes = seconds / 60;
    if (minutes < 60) {
        return { value: round(minutes), unit: "min" };
    }
    const hours = minutes / 60;
    if (hours < 24) {
        return { value: round(hours), unit: "hr" };
    }
    const days = hours / 24;
    return { value: round(days), unit: "day" };
}
function round(value) {
    return Math.round(value * 10) / 10;
}
function formatDurationRange(minSeconds, maxSeconds) {
    const min = formatSeconds(minSeconds);
    const max = formatSeconds(maxSeconds);
    // Same unit → show unit once
    if (min.unit === max.unit) {
        return `${min.value} - ${max.value} ${pluralize(max.unit, max.value)}`;
    }
    // Different units → show both
    return `${min.value} ${pluralize(min.unit, min.value)} - ${max.value} ${pluralize(max.unit, max.value)}`;
}
function pluralize(unit, value) {
    return value === 1 ? unit : `${unit}s`;
}
//# sourceMappingURL=time.formatter.js.map