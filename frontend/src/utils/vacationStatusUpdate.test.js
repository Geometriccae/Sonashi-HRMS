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
} from "./vacationStatusUpdate";
// eslint-disable-next-line import/first
import { VACATION_STATUS } from "./vacationStatusDisplay";

const employee = {
  _id: "emp-1",
  employeeName: "Any Employee",
  endDate: "2026-09-20",
};

/** What the date inputs send: the picked day, serialized the same way. */
const iso = (day) => new Date(day).toISOString();

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
      lastWorkingDay: iso("2026-09-01"),
      travellingDate: iso("2026-09-02"),
      leaveEndDate: iso("2026-09-20"),
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
      returnDate: iso("2026-09-21"),
      firstWorkingDay: iso("2026-09-21"),
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

    expect(dates).toEqual({ travellingDate: iso("2026-10-01") });
  });
});
