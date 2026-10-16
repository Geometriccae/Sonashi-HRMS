/**
 * Add or update one proven Employer ID -> SCR agent routing mapping.
 * Dry-run by default; pass --apply to save.
 *
 * Usage:
 *   node scripts/configureSifEmployerRouting.js <13-digit employer> <9-digit routing> [--apply]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const CompanySifSettings = require("../models/CompanySifSettings");

const employerId = String(process.argv[2] || "").replace(/\D/g, "");
const agentRoutingCode = String(process.argv[3] || "").replace(/\D/g, "");
const apply = process.argv.includes("--apply");

if (!/^\d{13}$/.test(employerId) || !/^\d{9}$/.test(agentRoutingCode)) {
  console.error("Usage: node scripts/configureSifEmployerRouting.js <13-digit employer> <9-digit routing> [--apply]");
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const settings = await CompanySifSettings.findOne({ key: "default" });
  if (!settings) throw new Error("Company SIF settings do not exist");

  const routes = Array.from(settings.employerRoutingCodes || []);
  const existing = routes.find((entry) => String(entry.employerId) === employerId);
  const previous = existing ? String(existing.agentRoutingCode || "") : "<missing>";
  if (existing) existing.agentRoutingCode = agentRoutingCode;
  else routes.push({ employerId, agentRoutingCode });

  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${employerId} SCR routing ${previous} -> ${agentRoutingCode}`);
  if (apply) {
    settings.employerRoutingCodes = routes;
    await settings.save();
    console.log("Saved. Employee and payroll records were not modified.");
  }
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
