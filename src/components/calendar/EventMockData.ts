import { addDays, subDays, setHours, setMinutes } from "date-fns";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description: string;
  location: string;
  type: "internal" | "outreach" | "external";
}

const today = new Date();

export const mockCalendarEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Championship Robotics Build",
    start: setMinutes(setHours(today, 15), 30),
    end: setMinutes(setHours(today, 18), 0),
    description: "Working on the new swerve modules.",
    location: "ARES Workshop",
    type: "internal",
  },
  {
    id: "2",
    title: "STEM Night at Local Elementary",
    start: setMinutes(setHours(addDays(today, 2), 17), 0),
    end: setMinutes(setHours(addDays(today, 2), 19), 30),
    description: "Demoing the robot for elementary school students.",
    location: "Lincoln Elementary",
    type: "outreach",
  },
  {
    id: "3",
    title: "FIRST Regional Qualifier",
    start: setMinutes(setHours(addDays(today, 5), 8), 0),
    end: setMinutes(setHours(addDays(today, 6), 17), 0),
    description: "Our first regional event of the season.",
    location: "High School Gym",
    type: "external",
  },
  {
    id: "4",
    title: "Sponsor Pitch Meeting",
    start: setMinutes(setHours(subDays(today, 3), 16), 0),
    end: setMinutes(setHours(subDays(today, 3), 17), 0),
    description: "Meeting with local tech company for sponsorship.",
    location: "Zoom",
    type: "internal",
  },
];
