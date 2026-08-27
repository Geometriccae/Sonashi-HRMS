const slots = require("../../frontend/src/data/masterTrackerLeaveSlots.json");
const expected = require("./excelExpectedLast5.json");

function tokens(v) {
  return String(v || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3);
}

const leftover = slots.filter((s) => !s.employeeId && ["2021", "2022"].includes(String(s.start).slice(0, 4)));
const names = [...new Set(leftover.map((s) => s.name))];
names.forEach((name) => {
  const first = tokens(name)[0] || "";
  const hits = expected.filter((p) => tokens(p.name)[0] === first);
  console.log(
    JSON.stringify({
      excelName: name,
      first,
      rosterHits: hits.map((h) => `${h.id} ${h.name}`),
    })
  );
});
