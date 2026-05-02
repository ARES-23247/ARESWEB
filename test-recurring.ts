import { RRule, rrulestr } from 'rrule';

const rruleStr = "FREQ=WEEKLY;BYDAY=MO";
const dateStart = "2026-05-01T10:00:00Z";

try {
  const rule = rrulestr(rruleStr, { dtstart: new Date(dateStart) });
  const dates = rule.all((d, i) => i < 52); 
  console.log(dates.length);
} catch (e) {
  console.error("Error", e);
}
