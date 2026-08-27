const slots = require("../../frontend/src/data/masterTrackerLeaveSlots.json");
const leftover = slots.filter((s) => !s.employeeId && ["2021", "2022", "2025", "2026"].includes(String(s.start).slice(0, 4)));
const byYear = {};
leftover.forEach((s) => {
  const y = s.start.slice(0, 4);
  if (!byYear[y]) byYear[y] = [];
  byYear[y].push(`${s.name} ${s.start}..${s.end}`);
});
Object.keys(byYear).sort().forEach((y) => {
  console.log("\n===", y, byYear[y].length, "===");
  byYear[y].forEach((line) => console.log(line));
});
