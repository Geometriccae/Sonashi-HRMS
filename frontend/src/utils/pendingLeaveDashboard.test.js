jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import axios from "axios";
import { isAuthorizeUser, ROLES } from "./permissions";
import { leaveManagementPath, teamManagementPath, annualVacationsPath } from "./cardNavigation";
import leaveRequestService from "../services/LeaveRequestService";

describe("Pending Leave Card for Authorized User Dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe("1. Role-Based Visibility - isAuthorizeUser", () => {
    test("identifies authorize_user role correctly", () => {
      expect(isAuthorizeUser("authorize_user")).toBe(true);
      expect(isAuthorizeUser("AUTHORIZE_USER")).toBe(true);
      expect(isAuthorizeUser("Authorize User")).toBe(true);
      expect(isAuthorizeUser("  authorize_user  ")).toBe(true);
      expect(isAuthorizeUser(ROLES.AUTHORIZE_USER)).toBe(true);
    });

    test("reads role from localStorage when no parameter is passed", () => {
      localStorage.setItem("role", "authorize_user");
      expect(isAuthorizeUser()).toBe(true);

      localStorage.setItem("role", "admin");
      expect(isAuthorizeUser()).toBe(false);

      localStorage.removeItem("role");
      expect(isAuthorizeUser()).toBe(false);
    });

    test("strictly rejects all other roles (Admin, HR, HOD, Viewer, Manager, Employee, etc.)", () => {
      const forbiddenRoles = [
        "admin",
        "hr",
        "hod",
        "viewer",
        "manager",
        "employee",
        "sales_lead",
        "sales_executive",
        "managing_director",
        "director",
        "accounts_manager",
        "chartering_manager",
        "business_development_manager",
        "office_assistance",
        "",
        null,
        undefined,
      ];

      forbiddenRoles.forEach((role) => {
        expect(isAuthorizeUser(role)).toBe(false);
      });
    });
  });

  describe("2. Navigation Consistency - leaveManagementPath", () => {
    test("generates the exact URL with Pending status, all years, and page 1", () => {
      const path = leaveManagementPath({ status: "Pending", year: "All" });
      expect(path).toBe("/leave-requests?status=Pending&year=All&page=1");
    });

    test("defaults to Pending and All years when called without arguments", () => {
      const path = leaveManagementPath();
      expect(path).toBe("/leave-requests?status=Pending&year=All&page=1");
    });
  });

  describe("3. Dynamic Pending Count - leaveRequestService.getPendingLeaveCount", () => {
    test("retrieves count from paginated total response", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          data: [{ _id: "1", status: "Pending" }],
          total: 7,
          metrics: { pending: 7, approved: 12, rejected: 3 },
        },
      });

      const count = await leaveRequestService.getPendingLeaveCount({ force: true });
      expect(count).toBe(7);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/leave-requests"),
        expect.objectContaining({
          params: expect.objectContaining({
            status: "Pending",
            page: 1,
            limit: 1,
            fresh: "1",
          }),
        })
      );
    });

    test("retrieves count from metrics.pending if total is missing", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          metrics: { pending: 4 },
        },
      });

      const count = await leaveRequestService.getPendingLeaveCount({ force: true });
      expect(count).toBe(4);
    });

    test("accurately counts pending leaves and excludes approved/rejected/cancelled when array returned", async () => {
      axios.get.mockResolvedValueOnce({
        data: [
          { _id: "1", status: "Pending" },
          { _id: "2", status: "Approved" },
          { _id: "3", status: "Pending" },
          { _id: "4", status: "Rejected" },
          { _id: "5", status: "Cancelled" },
          { _id: "6", status: "HOD Approved" },
          { _id: "7", status: "Pending" },
        ],
      });

      const count = await leaveRequestService.getPendingLeaveCount({ force: true });
      expect(count).toBe(3);
    });

    test("returns 0 when there are zero pending requests", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          data: [],
          total: 0,
          metrics: { pending: 0, approved: 10, rejected: 2 },
        },
      });

      const count = await leaveRequestService.getPendingLeaveCount({ force: true });
      expect(count).toBe(0);
    });

    test("handles API errors gracefully by re-throwing so UI shows real error, not fabricated count", async () => {
      axios.get.mockRejectedValueOnce(new Error("Network Error"));

      await expect(
        leaveRequestService.getPendingLeaveCount({ force: true })
      ).rejects.toThrow("Network Error");
    });
  });

  describe("4. Dashboard Cards Composition Logic", () => {
    const buildDashboardCards = (userRole, counts) => {
      const isAuthUser = isAuthorizeUser(userRole);
      return [
        { label: "Total Employees", value: counts.total, path: teamManagementPath("All") },
        { label: "Active Employees", value: counts.active, path: teamManagementPath("Active") },
        { label: "Inactive Employees", value: counts.inactive, path: teamManagementPath("Inactive") },
        ...(isAuthUser
          ? [
              {
                label: "Pending Leave",
                value: counts.pendingLeave != null ? counts.pendingLeave : "--",
                color: "#f97316",
                sub: "Requires approval",
                alert: Boolean(counts.pendingLeave && counts.pendingLeave > 0),
                tooltip: "Leave requests pending approval. Click to view in Leave Management.",
                path: leaveManagementPath({ status: "Pending", year: "All" }),
              },
            ]
          : []),
        { label: "On vacation", value: counts.onVacation, path: annualVacationsPath("onVacation") },
        { label: "Yet to go", value: counts.upcomingVacation, path: annualVacationsPath("yetToGo") },
        { label: "Returned back from vacation", value: counts.vacationReturn, path: annualVacationsPath("returned") },
        { label: "Visa Expiry", value: counts.visaExpiry },
        { label: "Passport Expiry", value: counts.passportExpiry },
      ];
    };

    const sampleCounts = {
      total: 100,
      active: 95,
      inactive: 5,
      onVacation: 3,
      upcomingVacation: 2,
      vacationReturn: 8,
      visaExpiry: 1,
      passportExpiry: 2,
      pendingLeave: 6,
    };

    test("Authorized User dashboard includes the Pending Leave card with correct count and path", () => {
      const cards = buildDashboardCards("authorize_user", sampleCounts);

      const pendingCard = cards.find((c) => c.label === "Pending Leave");
      expect(pendingCard).toBeDefined();
      expect(pendingCard.value).toBe(6);
      expect(pendingCard.color).toBe("#f97316");
      expect(pendingCard.path).toBe("/leave-requests?status=Pending&year=All&page=1");
      expect(pendingCard.alert).toBe(true);
      expect(cards).toHaveLength(9);
    });

    test("Admin dashboard does NOT include the Pending Leave card", () => {
      const cards = buildDashboardCards("admin", sampleCounts);
      const pendingCard = cards.find((c) => c.label === "Pending Leave");
      expect(pendingCard).toBeUndefined();
      expect(cards).toHaveLength(8);
    });

    test("HR dashboard does NOT include the Pending Leave card", () => {
      const cards = buildDashboardCards("hr", sampleCounts);
      const pendingCard = cards.find((c) => c.label === "Pending Leave");
      expect(pendingCard).toBeUndefined();
      expect(cards).toHaveLength(8);
    });

    test("HOD dashboard does NOT include the Pending Leave card", () => {
      const cards = buildDashboardCards("hod", sampleCounts);
      const pendingCard = cards.find((c) => c.label === "Pending Leave");
      expect(pendingCard).toBeUndefined();
      expect(cards).toHaveLength(8);
    });

    test("Viewer dashboard does NOT include the Pending Leave card", () => {
      const cards = buildDashboardCards("viewer", sampleCounts);
      const pendingCard = cards.find((c) => c.label === "Pending Leave");
      expect(pendingCard).toBeUndefined();
      expect(cards).toHaveLength(8);
    });

    test("Employee / standard user dashboard does NOT include the Pending Leave card", () => {
      const cards = buildDashboardCards("employee", sampleCounts);
      const pendingCard = cards.find((c) => c.label === "Pending Leave");
      expect(pendingCard).toBeUndefined();
      expect(cards).toHaveLength(8);
    });

    test("Pending Leave card handles zero count and sets alert to false", () => {
      const zeroCounts = { ...sampleCounts, pendingLeave: 0 };
      const cards = buildDashboardCards("authorize_user", zeroCounts);
      const pendingCard = cards.find((c) => c.label === "Pending Leave");
      expect(pendingCard).toBeDefined();
      expect(pendingCard.value).toBe(0);
      expect(pendingCard.alert).toBe(false);
    });

    test("Pending Leave card displays '--' when count is null/unavailable (does not fabricate 0)", () => {
      const nullCounts = { ...sampleCounts, pendingLeave: null };
      const cards = buildDashboardCards("authorize_user", nullCounts);
      const pendingCard = cards.find((c) => c.label === "Pending Leave");
      expect(pendingCard).toBeDefined();
      expect(pendingCard.value).toBe("--");
      expect(pendingCard.alert).toBe(false);
    });
  });
});
