/** Integration checks for Company Documents-backed company management. */
require("dotenv").config();
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const CompanyDocument = require("../models/CompanyDocument");
const companyDocumentRoutes = require("../routes/companyDocumentRoutes");
const sifRoutes = require("../routes/sifRoutes");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ role: { $in: ["admin", "hod"] } }).lean();
  assert.ok(user, "A write-authorized user is required for this integration test");

  const app = express();
  app.use(express.json());
  app.use("/api/company-documents", companyDocumentRoutes);
  app.use("/api/sif", sifRoutes);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/company-documents`;
  const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "5m" });
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const suffix = String(Date.now());
  const companyCode = `TEST${suffix}`;
  const employerId = `9${suffix.slice(-12).padStart(12, "0")}`;

  try {
    const initial = await fetch(`${base}/companies`, { headers });
    assert.equal(initial.status, 200);
    const initialCompanies = await initial.json();
    assert.ok(initialCompanies.length >= 5);
    const requiredCodes = [
      "0000000172509",
      "0000000246878",
      "0000002795780",
      "EZJ00001364308",
      "192692",
    ];
    requiredCodes.forEach((code) => {
      assert.ok(initialCompanies.some((company) => company.docNumber === code));
    });

    const initialSettings = await fetch(
      `http://127.0.0.1:${server.address().port}/api/sif/settings`,
      { headers }
    );
    assert.equal(initialSettings.status, 200);
    const initialOptions = await initialSettings.json();
    requiredCodes.forEach((code) => {
      assert.ok(initialOptions.employers.some((company) => company.companyCode === code));
    });

    const createdResponse = await fetch(`${base}/companies`, {
      method: "POST",
      headers,
      body: JSON.stringify({ particulars: `Test Company ${suffix}`, companyCode, employerId: "" }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.docNumber, companyCode);
    assert.equal(created.employerId, "");

    const saveSifConfiguration = await fetch(
      `http://127.0.0.1:${server.address().port}/api/sif/settings`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          companyCode,
          employerId,
          defaultAgentRoutingCode: "123456789",
        }),
      }
    );
    assert.equal(saveSifConfiguration.status, 200);

    const settingsAfterCreate = await fetch(
      `http://127.0.0.1:${server.address().port}/api/sif/settings`,
      { headers }
    );
    assert.equal(settingsAfterCreate.status, 200);
    const createdOptions = await settingsAfterCreate.json();
    assert.ok(createdOptions.employers.some((entry) =>
      entry.companyCode === companyCode && entry.employerId === employerId
        && entry.agentRoutingCode === "123456789"
    ));

    const duplicateResponse = await fetch(`${base}/companies`, {
      method: "POST",
      headers,
      body: JSON.stringify({ particulars: `Other ${suffix}`, companyCode, employerId: "" }),
    });
    assert.equal(duplicateResponse.status, 409);

    const assigned = initialCompanies.find((company) => company.docNumber === "0000000172509");
    assert.ok(assigned);
    const blockedDelete = await fetch(`${base}/companies/${assigned._id}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(blockedDelete.status, 409);

    const blockedConfiguredDelete = await fetch(`${base}/companies/${created._id}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(blockedConfiguredDelete.status, 409);

    const deletedConfiguration = await fetch(
      `http://127.0.0.1:${server.address().port}/api/sif/settings/company/${companyCode}`,
      { method: "DELETE", headers }
    );
    assert.equal(deletedConfiguration.status, 200);
    assert.equal((await CompanyDocument.findById(created._id).lean()).employerId, "");

    const deletedResponse = await fetch(`${base}/companies/${created._id}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(deletedResponse.status, 200);
    assert.equal(await CompanyDocument.exists({ _id: created._id }), null);

    const settingsAfterDelete = await fetch(
      `http://127.0.0.1:${server.address().port}/api/sif/settings`,
      { headers }
    );
    const deletedOptions = await settingsAfterDelete.json();
    assert.ok(!deletedOptions.employers.some((entry) => entry.companyCode === companyCode));

    console.log("Company management integration tests passed.");
  } finally {
    await CompanyDocument.deleteMany({ docNumber: companyCode });
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
