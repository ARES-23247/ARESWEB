import { parseISO } from "date-fns";

export const downloadICS = (event: {
  title: string;
  dateStart: string;
  dateEnd?: string | null;
  location?: string | null;
  locationAddress?: string | null;
}) => {
  if (!event) return;
  const startStr = parseISO(event.dateStart).toISOString().replace(/-|:|\.\d+/g, '');
  let endStr: string;
  if (event.dateEnd) {
    endStr = parseISO(event.dateEnd).toISOString().replace(/-|:|\.\d+/g, '');
  } else {
    const end = parseISO(event.dateStart);
    end.setHours(end.getHours() + 2);
    endStr = end.toISOString().replace(/-|:|\.\d+/g, '');
  }

  const locationParts = [];
  if (event.location) locationParts.push(event.location);
  if (event.locationAddress) locationParts.push(event.locationAddress);
  const locationString = locationParts.join(', ').replace(/,/g, '\\,');

  const icsData = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${locationString}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

