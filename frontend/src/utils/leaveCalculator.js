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
    const yearsOfActiveService = Math.max(1, currentYear - startYear + 1);
    const entitlement = yearsOfActiveService * 30;
    
    // Work stats for display
    const diffTime = Math.abs(today - joinDate);
    const workingYears = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
    const workingMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));

    // 2. Calculate Total Taken
    let totalTaken = 0;
    const empId = String(employee._id || "").toLowerCase();
    const empName = String(employee.employeeName || employee.name || "").toLowerCase().trim();

    if (allLeaveRequests && Array.isArray(allLeaveRequests)) {
        allLeaveRequests.forEach(req => {
            if (req.status !== "Approved" && req.status !== "HOD Approved") return;

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
    // 30 days / 1 year service = 1 Yearly Ticket
    // 60 days / 2 years service = 1 Biennial Ticket
    let airfareStatus = "Not Eligible";
    const yearsNum = parseFloat(workingYears);
    
    if (yearsNum >= 2.0) {
        airfareStatus = "Eligible (2-Year Benefit)";
    } else if (yearsNum >= 1.0) {
        airfareStatus = "Eligible (1-Year Benefit)";
    } else {
        const monthsRemaining = (12 - workingMonths).toFixed(1);
        airfareStatus = `Not Eligible (Needs ${monthsRemaining} more months)`;
    }

    return {
        workingMonths,
        workingYears,
        entitlement,
        totalTaken,
        balance: entitlement - totalTaken,
        airfareStatus
    };
};
