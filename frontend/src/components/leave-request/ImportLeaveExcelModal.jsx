import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import leaveRequestService from "../../services/LeaveRequestService";
import { useToast } from "../../context/ToastContext";
import "./LeaveForm.css"; // Reuse modal styles

function ImportLeaveExcelModal({ isOpen, onClose, onSuccess }) {
    const { showToast } = useToast();
    const [file, setFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [parsedData, setParsedData] = useState([]);
    const [sheets, setSheets] = useState([]);
    const [selectedSheets, setSelectedSheets] = useState({});
    const [errors, setErrors] = useState([]);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        parseExcel(selectedFile);
    };

    const parseExcel = (file) => {
        setIsParsing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                
                const sheetNames = workbook.SheetNames;
                setSheets(sheetNames);
                
                // Select all sheets except "Sheet" or ones that sound like summary
                const initialSelected = {};
                sheetNames.forEach(name => {
                    const lName = name.toLowerCase();
                    initialSelected[name] = !lName.includes('summary') && lName !== 'sheet';
                });
                setSelectedSheets(initialSelected);

                // Pre-parse all sheets to preview
                const allParsed = {};
                sheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                    allParsed[sheetName] = { json, rawRows };
                });
                setParsedData(allParsed);
                
            } catch (error) {
                console.error("Error parsing Excel:", error);
                showToast("Failed to parse Excel file", "error");
            } finally {
                setIsParsing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const toggleSheet = (sheetName) => {
        setSelectedSheets(prev => ({
            ...prev,
            [sheetName]: !prev[sheetName]
        }));
    };

    const findKey = (obj, possibleKeys) => {
        const keys = Object.keys(obj);
        for (const pKey of possibleKeys) {
            const normalizedPKey = pKey.toLowerCase().replace(/[\s_.-]/g, '');
            const found = keys.find(k => {
                const normalizedK = k.toLowerCase().replace(/[\s_.-]/g, '');
                return normalizedK === normalizedPKey || normalizedK.includes(normalizedPKey);
            });
            if (found && obj[found] !== undefined && obj[found] !== "") return obj[found];
        }
        return null;
    };

    const parseExcelDate = (val) => {
        let dateObj;
        if (!val) return new Date(NaN);
        if (typeof val === 'number') {
            // Excel epoch is Dec 30, 1899. This math returns exactly Midnight UTC on the calendar day.
            dateObj = new Date(Date.UTC(1899, 11, 30) + val * 86400000);
        } else if (typeof val === 'string') {
            const parts = val.trim().split(/[-/]/);
            if (parts.length === 3) {
                // assume DD-MM-YYYY
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                let y = parseInt(parts[2], 10);
                if (y < 100) y += 2000;
                if (m > 11) dateObj = new Date(val); // Fallback to JS parse if MM > 12
                else dateObj = new Date(Date.UTC(y, m, d)); // Force strictly into Midnight UTC
            } else {
                dateObj = new Date(val);
            }
        } else {
            dateObj = new Date(val.getTime());
        }
        
        return dateObj;
    };

    const handleImport = async () => {
        setIsImporting(true);
        setErrors([]);
        
        let allLeaves = [];
        let parsingErrors = [];
        
        try {
            sheets.forEach(sheetName => {
                if (!selectedSheets[sheetName]) return;
                
                const sheetData = parsedData[sheetName];
                if (!sheetData) return;
                
                const { rawRows } = sheetData;
                if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) return;
                
                // Find headers just to locate the Name/ID column
                let headerRowIdx = 0;
                let headerRow = [];
                for (let i = 0; i < Math.min(10, rawRows.length); i++) {
                    const r = rawRows[i];
                    if (!r || !Array.isArray(r)) continue;
                    const rowStr = r.map(c => String(c).toUpperCase().replace(/[\s_.-]/g, '')).join('');
                    if (rowStr.includes('STAFFNAME') || rowStr.includes('EMPLOYEENAME') || rowStr.includes('NAME') || rowStr.includes('LEAVE')) {
                        headerRowIdx = i;
                        headerRow = r;
                        break;
                    }
                }
                
                let nameColIdx = -1;
                let idColIdx = -1;
                
                for (let c = 0; c < headerRow.length; c++) {
                    const h = String(headerRow[c]).toUpperCase().replace(/[\s_.-]/g, '');
                    if (!h) continue;
                    if (['STAFFNAME', 'NAME', 'EMPLOYEENAME', 'FULLNAME'].includes(h)) nameColIdx = c;
                    if (['EMPID', 'ID', 'SLNO', 'SNO', 'NO', 'CODE'].includes(h) && idColIdx === -1) idColIdx = c;
                }
                
                // Fallback assumptions if headers fail completely
                if (nameColIdx === -1) nameColIdx = 1; // Usually Col B
                if (idColIdx === -1) idColIdx = 0;     // Usually Col A
                
                // Determine expected year from sheet name (if any) to filter out "Joining Date" false positives
                const expectedYearMatch = sheetName.match(/20\d{2}/);
                const expectedYear = expectedYearMatch ? parseInt(expectedYearMatch[0]) : NaN;
                
                let validRowsProcessed = 0;
                
                // Sweep every row below header
                for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
                    const row = rawRows[r];
                    if (!row || !Array.isArray(row) || row.length === 0) continue;
                    
                    const empName = row[nameColIdx];
                    const empId = row[idColIdx];
                    
                    if (!empName && !empId) continue;
                    if (String(empName).toUpperCase().includes('TOTAL') || String(empId).toUpperCase().includes('TOTAL')) continue;
                    
                    validRowsProcessed++;
                    
                    // Sweep horizontally across the row looking for dates
                    for (let c = 0; c < row.length; c++) {
                        // Skip the ID and Name columns
                        if (c === nameColIdx || c === idColIdx) continue;
                        
                        const val1 = row[c];
                        if (!val1) continue;
                        
                        let startDate = parseExcelDate(val1);
                        if (isNaN(startDate.getTime())) continue; // Not a date
                        
                        const y = startDate.getFullYear();
                        if (y < 2000 || y > 2100) continue; // Filter out bad years
                        if (!isNaN(expectedYear) && y !== expectedYear) continue; // Must match sheet year to avoid picking up "Joining Date"
                        
                        let endDate = startDate;
                        let skipNext = false;
                        
                        // Check if the adjacent cell is an end date
                        const val2 = row[c + 1];
                        if (val2) {
                            let nextDate = parseExcelDate(val2);
                            if (!isNaN(nextDate.getTime())) {
                                const y2 = nextDate.getFullYear();
                                if (y2 >= 2000 && y2 <= 2100 && nextDate >= startDate) {
                                    endDate = nextDate;
                                    skipNext = true; // Skip parsing this adjacent cell in the next loop iteration
                                }
                            }
                        }
                        
                        // Force the string to be exact UTC midnight of the local calendar date to prevent ANY timezone shifts
                        const formatUTC = (d) => {
                            if (isNaN(d.getTime())) return new Date().toISOString();
                            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T00:00:00.000Z`;
                        };

                        allLeaves.push({
                            rowNumber: r + 1, // Absolute Excel row number
                            sheetName: sheetName,
                            employeeId: String(empId || ''),
                            employeeName: String(empName || ''),
                            leaveType: 'Vacation', // Changed from Annual to match backend enum
                            startDate: formatUTC(startDate),
                            endDate: formatUTC(endDate),
                            reason: `Imported from ${sheetName}`,
                            status: 'Approved',
                            requestAirfare: false,
                            company: 'Sonashi',
                            department: ''
                        });
                        
                        if (skipNext) c++; // Fast forward
                    }
                }
                
                if (validRowsProcessed > 0 && allLeaves.length === 0) {
                    parsingErrors.push(`[${sheetName}] Scanned ${validRowsProcessed} employees but found NO dates matching year ${expectedYear || 'any'}`);
                }
            });

            if (allLeaves.length === 0) {
                setErrors([
                    "No valid leave records found to import.",
                    "Ensure your sheet contains:",
                    "- 'Employee Name' or 'EMP ID'",
                    "- Dates that match the Sheet's Year (e.g., sheet '2026' needs 2026 dates)",
                    ...parsingErrors.slice(0, 15)
                ]);
                showToast("Parsing failed. See errors.", "error");
                setIsImporting(false);
                return;
            }

            const BATCH_SIZE = 100;
            let totalImported = 0;
            let allBatchErrors = [];
            
            for (let i = 0; i < allLeaves.length; i += BATCH_SIZE) {
                const batch = allLeaves.slice(i, i + BATCH_SIZE);
                try {
                    const result = await leaveRequestService.bulkImport(batch);
                    totalImported += (result.importedCount || batch.length);
                    if (result.errors && result.errors.length > 0) {
                        allBatchErrors = [...allBatchErrors, ...result.errors];
                    }
                } catch (batchErr) {
                    console.error(`Batch ${i} failed:`, batchErr);
                    allBatchErrors.push(`Failed to import batch starting at row ${i + 1}: ${batchErr.response?.data?.message || batchErr.message}`);
                }
            }

            showToast(`Successfully imported ${totalImported} leaves.`, "success");
            if (allBatchErrors.length > 0) {
                setErrors(allBatchErrors);
            } else {
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error("Import error:", error);
            showToast(error.message || "Failed to import leave data", "error");
        } finally {
            setIsImporting(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && !isImporting) onClose();
    };

    // Calculate total rows selected
    let totalSelectedRows = 0;
    sheets.forEach(s => {
        if (selectedSheets[s]) totalSelectedRows += (parsedData[s]?.json?.length || 0);
    });

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 100000 }}>
            <div className="leave-modal-container" style={{ maxWidth: "600px" }}>
                <div className="leave-modal-header">
                    <div>
                        <h2 className="leave-modal-title">Import Leave Data</h2>
                        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#64748b" }}>
                            Upload Excel sheet to bulk import historical leave data
                        </p>
                    </div>
                    {!isImporting && <button className="leave-modal-close" onClick={onClose}>&times;</button>}
                </div>

                <div className="leave-modal-content" style={{ padding: "24px" }}>
                    {!file ? (
                        <div 
                            style={{ 
                                border: "2px dashed #cbd5e1", 
                                borderRadius: "12px", 
                                padding: "40px 20px", 
                                textAlign: "center",
                                cursor: "pointer",
                                background: "#f8fafc"
                            }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input 
                                type="file" 
                                accept=".xlsx, .xls" 
                                ref={fileInputRef} 
                                style={{ display: "none" }} 
                                onChange={handleFileChange}
                            />
                            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📊</div>
                            <h3 style={{ fontSize: "16px", color: "#334155", margin: "0 0 8px 0" }}>Click to upload Excel file</h3>
                            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Supports .xlsx and .xls formats</p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", background: "#f1f5f9", padding: "12px 16px", borderRadius: "8px" }}>
                                <div>
                                    <strong style={{ color: "#334155", fontSize: "14px" }}>{file.name}</strong>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>{(file.size / 1024).toFixed(1)} KB</div>
                                </div>
                                {!isImporting && (
                                    <button 
                                        onClick={() => { setFile(null); setSheets([]); setParsedData({}); setErrors([]); }}
                                        style={{ background: "none", border: "none", color: "#ef4444", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                                    >
                                        Change File
                                    </button>
                                )}
                            </div>

                            {isParsing ? (
                                <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Parsing Excel file...</div>
                            ) : sheets.length > 0 ? (
                                <div>
                                    <h4 style={{ fontSize: "14px", color: "#334155", margin: "0 0 12px 0" }}>Select Sheets to Import</h4>
                                    <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                                        {sheets.map(sheet => (
                                            <label key={sheet} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: selectedSheets[sheet] ? "#f0fdf4" : "#fff" }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!selectedSheets[sheet]} 
                                                    onChange={() => toggleSheet(sheet)}
                                                    style={{ marginRight: "12px", width: "16px", height: "16px" }}
                                                    disabled={isImporting}
                                                />
                                                <div>
                                                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>{sheet}</div>
                                                    <div style={{ fontSize: "12px", color: "#64748b" }}>{parsedData[sheet]?.json?.length || 0} rows found</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    
                                    <div style={{ marginTop: "16px", fontSize: "13px", color: "#64748b", background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                                        <strong>Note:</strong> The system will automatically map common columns like EMP ID, Staff Name, Start Date, End Date, and Leave Type. Rows without a Start Date will be skipped.
                                    </div>

                                    {errors.length > 0 && (
                                        <div style={{ marginTop: "16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px", maxHeight: "150px", overflowY: "auto" }}>
                                            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#b91c1c" }}>Import Warnings/Errors:</h4>
                                            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#991b1b" }}>
                                                {errors.map((err, i) => <li key={i}>{err}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className="leave-modal-footer">
                    <button 
                        className="leave-btn-secondary" 
                        onClick={onClose}
                        disabled={isImporting}
                    >
                        Cancel
                    </button>
                    <button 
                        className="leave-btn-primary" 
                        onClick={handleImport}
                        disabled={!file || totalSelectedRows === 0 || isImporting || isParsing}
                        style={{ background: isImporting ? "#94a3b8" : "#2563eb" }}
                    >
                        {isImporting ? "Importing..." : `Import Selected (${totalSelectedRows} rows)`}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ImportLeaveExcelModal;
