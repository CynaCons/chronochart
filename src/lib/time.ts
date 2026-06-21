export const dayMs = 24 * 60 * 60 * 1000;

/**
 * Safely format a date value for display. Returns the fallback (default "—")
 * when the input is missing or unparseable, instead of the literal "Invalid Date".
 */
export function formatDateSafe(
	input: string | number | Date | null | undefined,
	fallback = '—'
): string {
	if (input === null || input === undefined || input === '') return fallback;
	const d = new Date(input);
	if (isNaN(d.getTime())) return fallback;
	return d.toLocaleDateString();
}

/**
 * Format an ISO-like date string to YYYY-MM-DD. If parsing fails, return the original.
 * Accepts inputs like 'YYYY-MM-DD' or full ISO strings.
 */
export function formatISODate(input: string): string {
	if (!input) return input;
	// Fast path for already YYYY-MM-DD
	const m = /^\d{4}-\d{2}-\d{2}$/.exec(input);
	if (m) return input;
	const d = new Date(input);
	if (isNaN(d.getTime())) return input;
	// Use UTC to avoid TZ shifts
	const iso = d.toISOString();
	return iso.slice(0, 10);
}

/**
 * Get the full timestamp for an event that may have an optional time component.
 * If event has a time field, combines date and time. Otherwise uses date only.
 * Returns timestamp in milliseconds.
 */
export function getEventTimestamp(event: { date: string; time?: string }): number {
	if (event.time) {
		// Combine date and time: "YYYY-MM-DD" + " " + "HH:MM"
		const dateTimeString = `${event.date} ${event.time}`;
		const timestamp = new Date(dateTimeString).getTime();
		if (!isNaN(timestamp)) {
			return timestamp;
		}
	}

	// Fallback to date only
	return new Date(event.date).getTime();
}

/**
 * Format an event's date and optional time for display.
 * If event has time, shows both date and time. Otherwise shows date only.
 */
export function formatEventDateTime(event: { date: string; time?: string }): string {
	const timestamp = getEventTimestamp(event);
	const date = new Date(timestamp);

	if (event.time) {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	} else {
		return date.toLocaleDateString();
	}
}
