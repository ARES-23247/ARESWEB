export const downloadICS = (event: {
  title: string;
  date_start: string;
  date_end?: string | null;
  location?: string | null;
}) => {
  if (!event) return;
  const startStr = new Date(event.date_start).toISOString().replace(/-|:|\.\d+/g, '');
  let endStr: string;
  if (event.date_end) {
    endStr = new Date(event.date_end).toISOString().replace(/-|:|\.\d+/g, '');
  } else {
    const end = new Date(event.date_start);
    end.setHours(end.getHours() + 2);
    endStr = end.toISOString().replace(/-|:|\.\d+/g, '');
  }

  const icsData = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location || ''}`,
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
