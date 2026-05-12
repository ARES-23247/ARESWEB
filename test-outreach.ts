import { saveOutreachSchema } from "./shared/routes/outreach.ts";

const value = {
  id: "123",
  title: "Test Outreach",
  date: "2025-05-11",
  location: "School",
  studentsCount: 10,
  hours: 5,
  peopleReached: 50,
  impactSummary: "Good",
  isMentoring: false,
  mentoredTeamNumber: null,
  seasonId: 2025,
  eventId: null,
  mentorCount: 2,
  mentorHours: 10
};

try {
  const result = saveOutreachSchema.parse(value);
  console.log("Validation passed:", result);
} catch (e) {
  console.error("Validation failed:", e);
}
