/**
 * displayLastWorkingDay is imported from the pure utility module
 * (no React / router dependencies) so Jest can resolve it without mocking.
 */
import { displayLastWorkingDay } from "./vacationDisplayHelpers";
import { mapLeaveRow } from "./yetToGoHelpers";
import {
  buildEmployeeStatusPrompt,
  buildEmployeeStatusPayload,
} from "./employeeStatusUpdate";
import {
  buildVacationDatePrompt,
  datesFromPrompt,
} from "./vacationStatusUpdate";
import { VACATION_STATUS } from "./vacationStatusDisplay";

// Mock EmployeeService and LeaveRequestService used by vacationStatusUpdate
jest.mock("../services/EmployeeService", () => ({
  __esModule: true,
  default: { markVacationReturn: jest.fn(), updateVacationStatus: jest.fn(), invalidateCache: jest.fn() },
}));
jest.mock("../services/LeaveRequestService", () => ({
  __esModule: true,
  default: { invalidateCache: jest.fn() },
}));

describe("Last Working Date - Blank Value Retention & Independence", () => {
  describe("AnnualVacations displayLastWorkingDay", () => {
    test("remains blank (displays '—') when lastWorkingDay is null or undefined", () => {
      const itemWithNull = {
        lastWorkingDay: null,
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        travellingDate: "2026-10-01",
      };
      expect(displayLastWorkingDay(itemWithNull)).toBe("—");

      const itemWithUndefined = {
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        travellingDate: "2026-10-01",
      };
      expect(displayLastWorkingDay(itemWithUndefined)).toBe("—");

      const itemWithEmpty = {
        lastWorkingDay: "",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        travellingDate: "2026-10-01",
      };
      expect(displayLastWorkingDay(itemWithEmpty)).toBe("—");
    });

    test("does not fall back to Leave Start Date, Travel Date, Return Date, or Leave End Date", () => {
      const item = {
        lastWorkingDay: null,
        startDate: "2026-11-01",
        endDate: "2026-11-20",
        travellingDate: "2026-11-02",
        returnDate: "2026-11-21",
        leaveEndDate: "2026-11-20",
      };
      const displayed = displayLastWorkingDay(item);
      expect(displayed).toBe("—");
      expect(displayed).not.toContain("01/11/2026");
      expect(displayed).not.toContain("02/11/2026");
      expect(displayed).not.toContain("20/11/2026");
      expect(displayed).not.toContain("21/11/2026");
    });

    test("formats and displays valid Last Working Day when provided", () => {
      const item = {
        lastWorkingDay: "2026-09-30",
        startDate: "2026-10-05",
      };
      expect(displayLastWorkingDay(item)).toBe("30/09/2026");
    });
  });

  describe("mapLeaveRow", () => {
    test("keeps lastWorkingDay as null when employee has no lastWorkingDay", () => {
      const req = {
        _id: "leave-1",
        startDate: "2026-12-01",
        endDate: "2026-12-10",
        travellingDate: "2026-12-01",
        employeeName: "Alice Smith",
        employeeId: "EMP-101",
      };
      const empList = [
        {
          _id: "emp-101",
          employeeId: "EMP-101",
          employeeName: "Alice Smith",
          lastWorkingDay: null,
        },
      ];

      const row = mapLeaveRow(req, empList, "Vacation Pending");
      expect(row.lastWorkingDay).toBeNull();
    });

    test("does not take lastWorkingDay from leave request object if employee record has none", () => {
      const req = {
        _id: "leave-2",
        startDate: "2026-12-01",
        endDate: "2026-12-10",
        lastWorkingDay: "2026-11-28", // Should not be read from leave request
        employeeName: "Bob Jones",
        employeeId: "EMP-102",
      };
      const empList = [
        {
          _id: "emp-102",
          employeeId: "EMP-102",
          employeeName: "Bob Jones",
          lastWorkingDay: null,
        },
      ];

      const row = mapLeaveRow(req, empList, "Vacation Pending");
      expect(row.lastWorkingDay).toBeNull();
    });

    test("preserves employee's valid lastWorkingDay when present", () => {
      const req = {
        _id: "leave-3",
        startDate: "2026-12-01",
        endDate: "2026-12-10",
        employeeName: "Charlie Brown",
        employeeId: "EMP-103",
      };
      const empList = [
        {
          _id: "emp-103",
          employeeId: "EMP-103",
          employeeName: "Charlie Brown",
          lastWorkingDay: "2026-11-30",
        },
      ];

      const row = mapLeaveRow(req, empList, "Vacation Pending");
      expect(row.lastWorkingDay).toBe("2026-11-30");
    });
  });

  describe("Employee Status Update (Exit & Non-working workflows)", () => {
    test("initializes prompt lastWorkingDay as blank string when employee has no lastWorkingDay", () => {
      const employee = {
        _id: "emp-201",
        employeeName: "Dan Evans",
        employeeStatus: "Active",
        lastWorkingDay: null,
      };
      const prompt = buildEmployeeStatusPrompt(employee, "Resigned");
      expect(prompt.lastWorkingDay).toBe("");
    });

    test("builds payload with null lastWorkingDay when user leaves it blank", () => {
      const employee = {
        _id: "emp-201",
        employeeName: "Dan Evans",
        employeeStatus: "Active",
        lastWorkingDay: null,
      };
      const payload = buildEmployeeStatusPayload(employee, "Resigned", { lastWorkingDay: "" });
      expect(payload.lastWorkingDay).toBeNull();
    });

    test("builds payload with ISO date when user explicitly enters a Last Working Day", () => {
      const employee = {
        _id: "emp-201",
        employeeName: "Dan Evans",
        employeeStatus: "Active",
        lastWorkingDay: null,
      };
      const payload = buildEmployeeStatusPayload(employee, "Resigned", { lastWorkingDay: "2026-11-15" });
      expect(new Date(payload.lastWorkingDay).toISOString()).toBe(new Date("2026-11-15").toISOString());
    });
  });

  describe("Vacation Status Update modal", () => {
    test("prefills lastWorkingDay as empty when employee has no lastWorkingDay", () => {
      const employee = {
        _id: "emp-301",
        employeeName: "Eve Taylor",
        vacationStatus: "Onsite",
        lastWorkingDay: null,
        travellingDate: "2026-12-05",
      };
      const prompt = buildVacationDatePrompt(employee, VACATION_STATUS.YET_TO_GO);
      expect(prompt.dateValue).toBe("");
    });

    test("datesFromPrompt omits lastWorkingDay when left blank so backend does not overwrite existing data", () => {
      const prompt = {
        newStatus: VACATION_STATUS.YET_TO_GO,
        fieldKey: "lastWorkingDay",
        dateValue: "",
        secondaryFieldKey: "travellingDate",
        secondaryDateValue: "2026-12-05",
      };
      const { dates } = datesFromPrompt(prompt);
      expect(dates.lastWorkingDay).toBeUndefined();
      expect(dates.travellingDate).toBe("2026-12-05");
    });
  });
});

