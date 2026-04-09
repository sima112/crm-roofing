/**
 * ICS (iCalendar) file generation utility.
 * Produces RFC 5545-compliant .ics content.
 * No external dependencies.
 */

export type ICSEvent = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  /** ISO date string or "YYYY-MM-DD" */
  startDate: string;
  /** 24-hour "HH:MM" or null for all-day */
  startTime: string | null;
  /** Duration in minutes (default 120) */
  durationMinutes?: number;
  /** ISO string for DTSTAMP / created */
  created?: string;
};

/** Escape special chars per RFC 5545 §3.3.11 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/** Format a Date as YYYYMMDDTHHMMSSZ (UTC) */
function toUTCString(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Format a Date as YYYYMMDD (all-day) */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Fold long lines per RFC 5545 §3.1 (max 75 octets) */
function foldLine(line: string): string {
  const chunks: string[] = [];
  while (line.length > 75) {
    chunks.push(line.slice(0, 75));
    line = " " + line.slice(75);
  }
  chunks.push(line);
  return chunks.join("\r\n");
}

export function buildICS(events: ICSEvent[], calName = "CrewBooks Jobs"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CrewBooks//CrewBooks Calendar//EN",
    `X-WR-CALNAME:${escapeText(calName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    const dtstamp = toUTCString(ev.created ? new Date(ev.created) : new Date());
    const duration = ev.durationMinutes ?? 120;

    let dtstart: string;
    let dtend: string;

    if (ev.startTime) {
      // Timed event — treat the date+time as local (no timezone offset).
      // We use TZID-less floating time so it renders in the user's local tz.
      const [h, m] = ev.startTime.split(":").map(Number);
      const dateStr = ev.startDate.slice(0, 10); // YYYY-MM-DD
      const [yr, mo, day] = dateStr.split("-").map(Number);

      const startLocal = new Date(yr, mo - 1, day, h, m, 0);
      const endLocal = new Date(startLocal.getTime() + duration * 60_000);

      const fmt = (d: Date) =>
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;

      dtstart = `DTSTART:${fmt(startLocal)}`;
      dtend   = `DTEND:${fmt(endLocal)}`;
    } else {
      // All-day event
      const dateStr = ev.startDate.slice(0, 10).replace(/-/g, "");
      // End = next day
      const start = new Date(ev.startDate + "T00:00:00");
      const end   = new Date(start.getTime() + 24 * 60 * 60_000);
      dtstart = `DTSTART;VALUE=DATE:${dateStr}`;
      dtend   = `DTEND;VALUE=DATE:${toDateString(end)}`;
    }

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${ev.uid}`));
    lines.push(foldLine(`DTSTAMP:${dtstamp}`));
    lines.push(foldLine(dtstart));
    lines.push(foldLine(dtend));
    lines.push(foldLine(`SUMMARY:${escapeText(ev.summary)}`));
    if (ev.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeText(ev.description)}`));
    }
    if (ev.location) {
      lines.push(foldLine(`LOCATION:${escapeText(ev.location)}`));
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
