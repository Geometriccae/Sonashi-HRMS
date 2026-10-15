// The module talks to the employee/leave services; only its pure date logic is
// under test here, so the axios-backed services are stubbed out.
jest.mock("../services/EmployeeService", () => ({
  __esModule: true,
  default: { markVacationReturn: jest.fn(), updateVacationStatus: jest.fn(), invalidateCache: jest.fn() },
}));
jest.mock("../services/LeaveRequestService", () => ({
  __esModule: true,
  default: { invalidateCache: jest.fn() },
}));

// eslint-disable-next-line import/first
import {
  buildStatusChangePrompt,
  datesFromPrompt,
  getVacationDateConfig,
  toDateInputValue,
} from "./vacationStatusUpdate";
// eslint-disable-next-line import/first
import { VACATION_STATUS } from "./vacationStatusDisplay";

const employee = {
  _id: "emp-1",
  employeeName: "Any Employee",
  endDate: "2026-09-20",
};

describe("which dates each status asks for", () => {
  test("On Vacation and Yet to Go collect last working day, travel and leave end", () => {
    [VACATION_STATUS.ON_VACATION, VACATION_STATUS.YET_TO_GO].forEach((status) => {
      const prompt = buildStatusChangePrompt(employee, status);
      expect([prompt.fieldKey, prompt.secondaryFieldKey, prompt.tertiaryFieldKey]).toEqual([
        "lastWorkingDay",
        "travellingDate",
        "leaveEndDate",
      ]);
    });
  });

  test("Returned Back collects return/entry and first working day", () => {
    const prompt = buildStatusChangePrompt(employee, VACATION_STATUS.RETURNED_BACK);
    expect([prompt.fieldKey, prompt.secondaryFieldKey]).toEqual([
      "returnDate",
      "firstWorkingDay",
    ]);
  });

  test("Returned Back prefills from the planned leave end", () => {
    const prompt = buildStatusChangePrompt(employee, VACATION_STATUS.RETURNED_BACK);
    expect(prompt.dateValue).toBe("2026-09-20");
    expect(prompt.secondaryDateValue).toBe("2026-09-20");
  });

  test("Onsite saves without asking for a date", () => {
    expect(buildStatusChangePrompt(employee, VACATION_STATUS.ONSITE)).toBeNull();
    expect(getVacationDateConfig(VACATION_STATUS.ONSITE)).toBeNull();
  });
});

describe("prefilling a date input from a stored value", () => {
  test("a date-only string stays the day it names", () => {
    expect(toDateInputValue("2026-09-09")).toBe("2026-09-09");
  });

  /**
   * Vacation dates reach the client as timestamps, and the tables render them
   * with the local calendar day. The dialog has to prefill that same day,
   * otherwise saving it back shifts the date.
   */
  test("a stored timestamp prefills the calendar day it is displayed as", () => {
    const stored = new Date(2026, 8, 10);
    expect(toDateInputValue(stored.toISOString())).toBe("2026-09-10");
    expect(toDateInputValue(stored)).toBe("2026-09-10");
  });

  test("a prefilled date survives a save without moving", () => {
    const stored = new Date(2026, 8, 10);
    const { dates } = datesFromPrompt({
      newStatus: VACATION_STATUS.YET_TO_GO,
      fieldKey: "lastWorkingDay",
      dateValue: "",
      secondaryFieldKey: "travellingDate",
      secondaryDateValue: toDateInputValue(stored.toISOString()),
    });
    expect(toDateInputValue(dates.travellingDate)).toBe("2026-09-10");
  });

  test("today is today, not yesterday", () => {
    const now = new Date();
    const pad = (part) => String(part).padStart(2, "0");
    expect(toDateInputValue(now)).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    );
  });

  test("missing and unparseable values prefill as empty", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("")).toBe("");
    expect(toDateInputValue("not a date")).toBe("");
  });
});

describe("dates submitted from a confirmed prompt", () => {
  test("every selected date is sent under its own field", () => {
    const { dates, error } = datesFromPrompt({
      newStatus: VACATION_STATUS.ON_VACATION,
      fieldKey: "lastWorkingDay",
      dateValue: "2026-09-01",
      secondaryFieldKey: "travellingDate",
      secondaryDateValue: "2026-09-02",
      tertiaryFieldKey: "leaveEndDate",
      tertiaryDateValue: "2026-09-20",
    });

    expect(error).toBeUndefined();
    expect(dates).toEqual({
      lastWorkingDay: "2026-09-01",
      travellingDate: "2026-09-02",
      leaveEndDate: "2026-09-20",
    });
  });

  test("Returned Back requires the return date instead of saving silently", () => {
    const { dates, error } = datesFromPrompt({
      newStatus: VACATION_STATUS.RETURNED_BACK,
      fieldKey: "returnDate",
      dateValue: "",
      secondaryFieldKey: "firstWorkingDay",
      secondaryDateValue: "",
    });

    expect(dates).toBeUndefined();
    expect(error).toBe("Please select the Return / Entry Date.");
  });

  test("Returned Back defaults the first working day to the return date", () => {
    const { dates } = datesFromPrompt({
      newStatus: VACATION_STATUS.RETURNED_BACK,
      fieldKey: "returnDate",
      dateValue: "2026-09-21",
      secondaryFieldKey: "firstWorkingDay",
      secondaryDateValue: "",
    });

    expect(dates).toEqual({
      returnDate: "2026-09-21",
      firstWorkingDay: "2026-09-21",
    });
  });

  test("blank optional dates are left out rather than sent as invalid values", () => {
    const { dates } = datesFromPrompt({
      newStatus: VACATION_STATUS.YET_TO_GO,
      fieldKey: "lastWorkingDay",
      dateValue: "",
      secondaryFieldKey: "travellingDate",
      secondaryDateValue: "2026-10-01",
      tertiaryFieldKey: "leaveEndDate",
      tertiaryDateValue: "",
    });

    expect(dates).toEqual({ travellingDate: "2026-10-01" });
  });
});
