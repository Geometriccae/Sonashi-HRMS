export const calculateLeaveBalance = (employee, allLeaveRequests) => {
    if (!employee) {
        return { workingMonths: 0, workingYears: 0, entitlement: 0, totalTaken: 0, balance: 0 };
    }

    // 1. Tenure & Entitlement
    const joinDate = employee.doj ? new Date(employee.doj) : new Date();
    const today = new Date();
    
    // Policy: 30 days flat per year
    const startYear = joinDate.getFullYear();
    const currentYear = today.getFullYear();
    const totalYearsOfService = Math.max(1, currentYear - startYear + 1);
    
    // Capped at last 5 years (150 days)
    const activeYears = Math.min(totalYearsOfService, 5);
    const entitlement = activeYears * 30;
    const expiredDays = Math.max(0, (totalYearsOfService - activeYears) * 30);
    
    // Work stats for display
    const diffTime = Math.abs(today - joinDate);
    const workingYears = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
    const workingMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));

    // 2. Calculate Total Taken (only in last 5 years)
    let totalTaken = 0;
    const empId = String(employee._id || "").toLowerCase();
    const empName = String(employee.employeeName || employee.name || "").toLowerCase().trim();
    const cutoffYear = currentYear - 4;

    if (allLeaveRequests && Array.isArray(allLeaveRequests)) {
        allLeaveRequests.forEach(req => {
            if (req.status !== "Approved" && req.status !== "HOD Approved") return;

            const reqYear = new Date(req.startDate).getFullYear();
            if (reqYear < cutoffYear) return; // Ignore leaves older than 5 years

            const reqName = String(req.employeeName || "").toLowerCase().trim();
            const reqEmpObj = req.employee;
            let isMatch = false;

            // Match by name (most reliable since it's saved in the request)
            if (reqName && reqName === empName) {
                isMatch = true;
            } else if (reqEmpObj) {
                // Try matching by employeeId link
                const linkedId = String(reqEmpObj.employeeId?._id || reqEmpObj.employeeId || "").toLowerCase();
                if (linkedId && linkedId === empId) isMatch = true;
            }

            if (isMatch) {
                const s = new Date(req.startDate);
                const e = new Date(req.endDate);
                if (!isNaN(s) && !isNaN(e)) {
                    const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    if (days > 0) totalTaken += days;
                }
            }
        });
    }

    // 3. Airfare Eligibility
    // Simple check based on employee's eligibility field
    let airfareEligible = employee.airFare === true || employee.airFare === "true" || employee.airFare === "Yes";
    let airfareStatus = airfareEligible ? "Eligible" : "Not Eligible";

    return {
        workingMonths,
        workingYears,
        entitlement,
        expiredDays,
        totalTaken,
        balance: entitlement - totalTaken,
        airfareStatus,
        airfareEligible
    };
};
