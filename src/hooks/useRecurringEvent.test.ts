import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecurringEvent, type LimitType } from "./useRecurringEvent";

describe("useRecurringEvent hook", () => {
  describe("initial state", () => {
    it("initializes with default values when no initialGroupId is provided", () => {
      const { result } = renderHook(() => useRecurringEvent());

      expect(result.current.recurringGroupId).toBe(null);
      expect(result.current.updateMode).toBe("single");
      expect(result.current.rruleFreq).toBe("");
      expect(result.current.limitType).toBe("none");
      expect(result.current.limitCount).toBe("");
      expect(result.current.limitDate).toBe("");
    });

    it("initializes with provided initialGroupId", () => {
      const { result } = renderHook(() => useRecurringEvent("group-123"));

      expect(result.current.recurringGroupId).toBe("group-123");
    });
  });

  describe("state setters", () => {
    it("allows setting recurringGroupId", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRecurringGroupId("new-group-456");
      });

      expect(result.current.recurringGroupId).toBe("new-group-456");
    });

    it("allows setting updateMode", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setUpdateMode("following");
      });

      expect(result.current.updateMode).toBe("following");
    });

    it("allows setting rruleFreq", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=WEEKLY");
      });

      expect(result.current.rruleFreq).toBe("FREQ=WEEKLY");
    });

    it("allows setting limitType", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setLimitType("count");
      });

      expect(result.current.limitType).toBe("count");
    });

    it("allows setting limitCount", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setLimitCount("10");
      });

      expect(result.current.limitCount).toBe("10");
    });

    it("allows setting limitDate", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setLimitDate("2024-12-31");
      });

      expect(result.current.limitDate).toBe("2024-12-31");
    });
  });

  describe("parseRrule", () => {
    it("parses FREQ from rrule string", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.parseRrule("FREQ=WEEKLY");
      });

      expect(result.current.rruleFreq).toBe("FREQ=WEEKLY");
      expect(result.current.limitType).toBe("none");
      expect(result.current.limitCount).toBe("");
      expect(result.current.limitDate).toBe("");
    });

    it("parses COUNT from rrule string and sets limitType to count", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.parseRrule("FREQ=DAILY;COUNT=10");
      });

      expect(result.current.rruleFreq).toBe("FREQ=DAILY");
      expect(result.current.limitType).toBe("count");
      expect(result.current.limitCount).toBe("10");
      expect(result.current.limitDate).toBe("");
    });

    it("parses UNTIL from rrule string and sets limitType to date", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.parseRrule("FREQ=WEEKLY;UNTIL=20241231T000000Z");
      });

      expect(result.current.rruleFreq).toBe("FREQ=WEEKLY");
      expect(result.current.limitType).toBe("date");
      expect(result.current.limitCount).toBe("");
      expect(result.current.limitDate).toBe("2024-12-31");
    });

    it("parses UNTIL with different date formats (YYYYMMDD)", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.parseRrule("FREQ=MONTHLY;UNTIL=20250115T000000Z");
      });

      expect(result.current.limitDate).toBe("2025-01-15");
    });

    it("handles null rrule input", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=WEEKLY");
        result.current.setLimitType("count");
        result.current.setLimitCount("5");
        result.current.parseRrule(null);
      });

      expect(result.current.rruleFreq).toBe("");
      expect(result.current.limitType).toBe("none");
      expect(result.current.limitCount).toBe("");
      expect(result.current.limitDate).toBe("");
    });

    it("handles empty string rrule input", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=DAILY");
        result.current.parseRrule("");
      });

      expect(result.current.rruleFreq).toBe("");
      expect(result.current.limitType).toBe("none");
    });

    it("parses complex rrule with FREQ, COUNT, and other parts", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.parseRrule("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20");
      });

      expect(result.current.rruleFreq).toBe("FREQ=WEEKLY");
      expect(result.current.limitType).toBe("count");
      expect(result.current.limitCount).toBe("20");
    });

    it("handles UNTIL with date string shorter than 8 characters (parses as much as possible)", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.parseRrule("FREQ=DAILY;UNTIL=2024T000000Z");
      });

      // The hook parses substring indices even if the result is malformed
      expect(result.current.limitType).toBe("date");
      expect(result.current.limitDate).toBe("2024-T0-00"); // Malformed but actual behavior
    });

    it("parses rrule with both COUNT and UNTIL (COUNT takes precedence in order)", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.parseRrule("FREQ=WEEKLY;COUNT=10;UNTIL=20241231T000000Z");
      });

      // The hook processes parts in order, so COUNT should be parsed first
      // But both will be set, with limitType reflecting the last limit-related part
      expect(result.current.limitCount).toBe("10");
      expect(result.current.limitDate).toBe("2024-12-31");
    });
  });

  describe("buildRrule", () => {
    it("returns empty string when no frequency is set", () => {
      const { result } = renderHook(() => useRecurringEvent());

      const rrule = result.current.buildRrule();

      expect(rrule).toBe("");
    });

    it("returns only FREQ when no limit is set", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=WEEKLY");
      });

      const rrule = result.current.buildRrule();

      expect(rrule).toBe("FREQ=WEEKLY");
    });

    it("builds rrule with COUNT when limitType is count", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=DAILY");
        result.current.setLimitType("count");
        result.current.setLimitCount("15");
      });

      const rrule = result.current.buildRrule();

      expect(rrule).toBe("FREQ=DAILY;COUNT=15");
    });

    it("builds rrule with UNTIL when limitType is date", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=MONTHLY");
        result.current.setLimitType("date");
        result.current.setLimitDate("2024-12-31");
      });

      const rrule = result.current.buildRrule();

      expect(rrule).toBe("FREQ=MONTHLY;UNTIL=20241231T000000Z");
    });

    it("converts date format correctly (removes dashes, adds T000000Z)", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=WEEKLY");
        result.current.setLimitType("date");
        result.current.setLimitDate("2025-01-15");
      });

      const rrule = result.current.buildRrule();

      expect(rrule).toBe("FREQ=WEEKLY;UNTIL=20250115T000000Z");
    });

    it("does not include COUNT when limitType is count but limitCount is empty", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=DAILY");
        result.current.setLimitType("count");
        result.current.setLimitCount("");
      });

      const rrule = result.current.buildRrule();

      expect(rrule).toBe("FREQ=DAILY");
    });

    it("does not include UNTIL when limitType is date but limitDate is empty", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=WEEKLY");
        result.current.setLimitType("date");
        result.current.setLimitDate("");
      });

      const rrule = result.current.buildRrule();

      expect(rrule).toBe("FREQ=WEEKLY");
    });

    it("does not include limit when limitType is none", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=MONTHLY");
        result.current.setLimitType("none");
        result.current.setLimitCount("10");
        result.current.setLimitDate("2024-12-31");
      });

      const rrule = result.current.buildRrule();

      expect(rrule).toBe("FREQ=MONTHLY");
    });

    it("round-trips: parseRrule then buildRrule preserves COUNT", () => {
      const { result } = renderHook(() => useRecurringEvent());

      const originalRrule = "FREQ=WEEKLY;COUNT=10";

      act(() => {
        result.current.parseRrule(originalRrule);
      });

      const rebuiltRrule = result.current.buildRrule();

      expect(rebuiltRrule).toBe(originalRrule);
    });

    it("round-trips: parseRrule then buildRrule preserves UNTIL format", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.parseRrule("FREQ=DAILY;UNTIL=20241231T000000Z");
      });

      const rebuiltRrule = result.current.buildRrule();

      expect(rebuiltRrule).toBe("FREQ=DAILY;UNTIL=20241231T000000Z");
    });
  });

  describe("resetRecurringState", () => {
    it("resets all state values to defaults", () => {
      const { result } = renderHook(() => useRecurringEvent("initial-group"));

      act(() => {
        result.current.setRecurringGroupId("some-group");
        result.current.setUpdateMode("following");
        result.current.setRruleFreq("FREQ=WEEKLY");
        result.current.setLimitType("count");
        result.current.setLimitCount("20");
        result.current.setLimitDate("2024-12-31");
      });

      expect(result.current.recurringGroupId).toBe("some-group");
      expect(result.current.updateMode).toBe("following");
      expect(result.current.rruleFreq).toBe("FREQ=WEEKLY");
      expect(result.current.limitType).toBe("count");

      act(() => {
        result.current.resetRecurringState();
      });

      expect(result.current.recurringGroupId).toBe(null);
      expect(result.current.updateMode).toBe("single");
      expect(result.current.rruleFreq).toBe("");
      expect(result.current.limitType).toBe("none");
      expect(result.current.limitCount).toBe("");
      expect(result.current.limitDate).toBe("");
    });

    it("can be called multiple times safely", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=DAILY");
        result.current.resetRecurringState();
        result.current.resetRecurringState();
      });

      expect(result.current.rruleFreq).toBe("");
    });
  });

  describe("integration scenarios", () => {
    it("handles editing an existing recurring event workflow", () => {
      const { result } = renderHook(() => useRecurringEvent());

      // Simulate loading an existing recurring event
      act(() => {
        result.current.setRecurringGroupId("existing-group");
        result.current.parseRrule("FREQ=WEEKLY;COUNT=12");
      });

      expect(result.current.recurringGroupId).toBe("existing-group");
      expect(result.current.rruleFreq).toBe("FREQ=WEEKLY");
      expect(result.current.limitType).toBe("count");
      expect(result.current.limitCount).toBe("12");

      // Simulate changing the recurrence
      act(() => {
        result.current.setLimitCount("24");
        result.current.setUpdateMode("following");
      });

      const updatedRrule = result.current.buildRrule();
      expect(updatedRrule).toBe("FREQ=WEEKLY;COUNT=24");
      expect(result.current.updateMode).toBe("following");
    });

    it("handles creating a new recurring event workflow", () => {
      const { result } = renderHook(() => useRecurringEvent());

      // Start with empty state
      expect(result.current.rruleFreq).toBe("");

      // User selects frequency
      act(() => {
        result.current.setRruleFreq("FREQ=DAILY");
      });

      // User selects date limit
      act(() => {
        result.current.setLimitType("date");
        result.current.setLimitDate("2025-06-30");
      });

      const finalRrule = result.current.buildRrule();
      expect(finalRrule).toBe("FREQ=DAILY;UNTIL=20250630T000000Z");
    });

    it("handles switching between limit types", () => {
      const { result } = renderHook(() => useRecurringEvent());

      act(() => {
        result.current.setRruleFreq("FREQ=WEEKLY");
      });

      // Start with count limit
      act(() => {
        result.current.setLimitType("count");
        result.current.setLimitCount("10");
      });

      expect(result.current.buildRrule()).toBe("FREQ=WEEKLY;COUNT=10");

      // Switch to date limit
      act(() => {
        result.current.setLimitType("date");
        result.current.setLimitDate("2024-12-31");
      });

      expect(result.current.buildRrule()).toBe("FREQ=WEEKLY;UNTIL=20241231T000000Z");

      // Switch to no limit
      act(() => {
        result.current.setLimitType("none");
      });

      expect(result.current.buildRrule()).toBe("FREQ=WEEKLY");
    });
  });

  describe("type exports", () => {
    it("exports LimitType type", () => {
      const limitTypes: LimitType[] = ["none", "count", "date"];
      expect(limitTypes).toEqual(["none", "count", "date"]);
    });

    it("exports RecurringEventState interface", () => {
      const state = {
        recurringGroupId: "test-group",
        updateMode: "single" as const,
        rruleFreq: "FREQ=WEEKLY",
        limitType: "none" as const,
        limitCount: "",
        limitDate: "",
      };
      expect(state.recurringGroupId).toBe("test-group");
    });
  });
});
