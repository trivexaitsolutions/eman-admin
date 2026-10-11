// Parse an HTML date-only DOB as UTC to avoid server timezone rollover.
function parseDobInput(raw) {
    if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const date = new Date(`${raw}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw ? date : null;
}

function formatDobInput(raw) {
    if (!raw) return "";
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return parseDobInput(raw) ? raw : "";
    }
    const date = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

module.exports = { parseDobInput, formatDobInput };
