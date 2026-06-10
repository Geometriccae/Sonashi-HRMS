export const calculateLeaveDays = (startDate, endDate) => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : null;
};

export const calculateLeaveBalance = (employee, allLeaveRequests, calculationDate = null) => {
    if (!employee) {
        return { 
            workingMonths: 0, 
            workingYears: 0, 
            entitlement: 0, 
            totalTaken: 0, 
            balance: 0, 
            airfareStatus: "N/A", 
            airfareEligible: false, 
            airfareAvailable: false 
        };
    }

    // 1. Tenure & Entitlement
    const joinDate = employee.doj ? new Date(employee.doj) : new Date();
    const today = calculationDate ? new Date(calculationDate) : new Date();
    
    // Work stats for display
    const diffTime = Math.abs(today - joinDate);
    const workingYears = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
    const workingMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    const currentYear = today.getFullYear();

    // Policy: 2.5 days per month (strictly based on a 30-day month)
    const totalWorkingDays = diffTime / (1000 * 60 * 60 * 24);
    const exactEntitlement = (totalWorkingDays / 30) * 2.5;
    
    // Capped at last 5 years (150 days)
    const activeEntitlement = Math.min(exactEntitlement, 150);
    const expiredEntitlement = Math.max(0, exactEntitlement - 150);
    
    const entitlement = Math.floor(activeEntitlement);
    const expiredDays = Math.floor(expiredEntitlement);

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

    // 3. Airfare Eligibility & Availability
    // First, check if the benefit is even offered to this employee in their profile
    const benefitActiveInProfile = employee.airFare === true || employee.airFare === "true" || employee.airFare === "Yes";
    
    let lastAirfareDate = null;
    let airfareUsedRecently = false;
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setFullYear(today.getFullYear() - 2);

    if (allLeaveRequests && Array.isArray(allLeaveRequests)) {
        allLeaveRequests.forEach(req => {
            if (req.status !== "Approved" && req.status !== "HOD Approved") return;
            if (!req.requestAirfare) return;

            const reqName = String(req.employeeName || "").toLowerCase().trim();
            if (reqName === empName) {
                const airfareDate = new Date(req.startDate);
                if (!lastAirfareDate || airfareDate > lastAirfareDate) {
                    lastAirfareDate = airfareDate;
                }
                if (airfareDate > twoYearsAgo) {
                    airfareUsedRecently = true;
                }
            }
        });
    }

    const experienceYears = parseFloat(workingYears);
    const hasMinExperience = experienceYears >= 2.0;

    let airfareEligible = hasMinExperience;
    let airfareAvailable = hasMinExperience;
    
    let airfareStatus = hasMinExperience ? "Available" : "Personal Ticket Only";

    return {
        workingMonths,
        workingYears,
        entitlement,
        expiredDays,
        totalTaken,
        balance: entitlement - totalTaken,
        airfareStatus,
        airfareEligible,
        airfareAvailable,
        lastAirfareDate
    };
};
