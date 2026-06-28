import { TeamEvent } from "@/types/event";
export type { TeamEvent };

export const MOCK_EVENTS: TeamEvent[] = [
  {
    id: "event_1",
    title: "Spark! Goes WILD Exhibition",
    dateStart: "2026-05-24T09:30:00",
    dateEnd: "2026-05-24T14:30:00",
    location: "SPARK! WV Museum",
    description: "Team outreach, STEM workshops, and public science bridge exhibits.",
    category: "outreach"
  },
  {
    id: "event_2",
    title: "Sunday Night Driver Practice",
    dateStart: "2026-05-24T18:00:00",
    dateEnd: "2026-05-24T20:30:00",
    location: "MARS Laboratory",
    description: "Weekly telemetry calibrations and driver practice on standard field.",
    category: "internal"
  },
  {
    id: "event_3",
    title: "Friday Night Hardware Lab",
    dateStart: "2026-05-29T18:00:00",
    dateEnd: "2026-05-29T20:00:00",
    location: "ARES Machine Shop",
    description: "Weekly hardware maintenance, linear slide adjustments, and intake tuning.",
    category: "internal"
  },
  {
    id: "event_4",
    title: "Sunday Night EKF Tuning",
    dateStart: "2026-05-31T18:00:00",
    dateEnd: "2026-05-31T20:30:00",
    location: "MARS Laboratory",
    description: "Main chassis odometry calibrations and autonomous state-slip test runs.",
    category: "internal"
  },
  {
    id: "event_5",
    title: "Overnight Scrimmage & Prep",
    dateStart: "2026-06-12T18:00:00",
    dateEnd: "2026-06-13T01:00:00",
    location: "Championship Scrimmage Field",
    description: "Extended overnight competition prep and match simulation.",
    category: "internal"
  },
  {
    id: "event_6",
    title: "FLL Robotics Mentorship Camp",
    dateStart: "2026-06-18T10:00:00",
    dateEnd: "2026-06-18T15:00:00",
    location: "Spark! Learning Space",
    description: "ARES mentors conducting visual block-coding tutorials for local FLL students.",
    category: "outreach"
  },
  {
    id: "event_7",
    title: "Into The Deep Finals Scrimmage",
    dateStart: "2026-06-21T13:00:00",
    dateEnd: "2026-06-21T18:00:00",
    location: "MARS Laboratory",
    description: "Final mock matches with regional alliance teams to optimize autonomous target routes.",
    category: "internal"
  }
];
