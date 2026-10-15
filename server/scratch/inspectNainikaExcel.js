const ExcelJS = require('../../frontend/node_modules/exceljs');
const { parseLeaveMasterWorkbook, ymd } = require('../utils/excelLeaveWorkbook');

const SRC =
  process.argv[2] ||
  'C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx';

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const parsed = await parseLeaveMasterWorkbook(wb);
  const hits = parsed.master.employees.filter(
    (e) => /nainika/i.test(e.staffName || '') || /IDMO-197/i.test(e.employeeId || '') || /IDMO-198/i.test(e.employeeId || '')
  );
  console.log('FILE', SRC);
  console.log(JSON.stringify(hits.map((e) => ({
    id: e.employeeId,
    name: e.staffName,
    doj: e.joiningDate ? ymd(e.joiningDate) : null,
    years: e.years,
    last5Taken: e.last5Taken,
    leaveDue: e.leaveDue,
    avrg: e.avrg,
  })), null, 2));
  const slots = parsed.leaves.filter(
    (l) => /nainika/i.test(l.employeeName || '') || /IDMO-197/i.test(l.employeeId || '')
  );
  console.log('SLOTS', slots.length, JSON.stringify(slots.slice(0, 20), null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
