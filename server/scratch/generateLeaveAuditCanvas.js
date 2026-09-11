/**
 * Builds the read-only audit canvas from leaveAuditCanvasData.json.
 */
const fs = require("fs");
const path = require("path");

const data = require("./leaveAuditCanvasData.json");

const keep = data.keep.map((r) => ({
  id: r.id,
  employeeId: r.employeeId || "",
  employeeName: r.employeeName || "",
  leaveType: r.leaveType || "",
  startDate: r.startDate || "",
  endDate: r.endDate || "",
  leaveDays: r.leaveDays === "" || r.leaveDays == null ? "" : String(r.leaveDays),
  status: r.status || "",
  reason: r.reason || "",
  importSource: r.importSource || "",
  createdBy: r.createdBy || "",
  createdByUser: r.createdByUser || "",
  adminApprovedBy: r.adminApprovedBy || "",
  changedBy: r.changedBy || "",
  changedByUser: r.changedByUser || "",
  evidence: r.clientEvidence || "",
}));

const uncertain = data.uncertain.map((r) => ({
  id: r.id,
  employeeId: r.employeeId || "",
  employeeName: r.employeeName || "",
  leaveType: r.leaveType || "",
  startDate: r.startDate || "",
  endDate: r.endDate || "",
  reason: r.reason || "",
  importSource: r.importSource || "",
  createdBy: r.createdBy || "",
  scriptSource: r.scriptSource || "",
  why: r.whyUncertain || "",
  needed: r.neededEvidence || "",
}));

const employeeWise = data.employeeWise;
const payload = {
  generatedAt: data.generatedAt,
  counts: data.counts,
  integrity: data.integrity,
  clientUsernames: data.clientUsernames,
  uncertainScript: uncertain.filter((r) => r.scriptSource).length,
  uncertainOther: uncertain.filter((r) => !r.scriptSource).length,
  keep,
  uncertain,
  employeeWise,
  melvin: data.melvin,
  mehtab: data.mehtab,
};

const json = JSON.stringify(payload);

const tsx = `import {
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
} from "cursor/canvas";

const DATA = ${json} as const;

function matches(hay: string, q: string) {
  return hay.toLowerCase().includes(q.toLowerCase());
}

export default function LeaveManagementAudit() {
  const [tab, setTab] = useCanvasState<"keep" | "uncertain" | "employees">("tab", "keep");
  const [query, setQuery] = useCanvasState("query", "");

  const keepRows = DATA.keep.filter((r) => {
    if (!query.trim()) return true;
    const blob = [r.id, r.employeeId, r.employeeName, r.leaveType, r.reason, r.changedBy, r.evidence].join(" ");
    return matches(blob, query);
  });
  const uncertainRows = DATA.uncertain.filter((r) => {
    if (!query.trim()) return true;
    const blob = [r.id, r.employeeId, r.employeeName, r.leaveType, r.reason, r.scriptSource, r.why].join(" ");
    return matches(blob, query);
  });
  const empRows = DATA.employeeWise.filter((r) => {
    if (!query.trim()) return true;
    return matches(r.employee, query);
  });

  const melvinKeep = DATA.melvin.keep;
  const melvinUncertain = DATA.melvin.uncertain;
  const mehtabKeep = DATA.mehtab.keep;
  const mehtabUncertain = DATA.mehtab.uncertain;

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <H1>Leave Management audit</H1>
        <Text tone="secondary">
          Read-only classification of every LeaveRequest as of {DATA.generatedAt}. No records were deleted, updated, or inserted.
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(DATA.counts.total)} label="Total leave records" />
        <Stat value={String(DATA.counts.safeToDelete)} label="Safe to delete" tone="success" />
        <Stat value={String(DATA.counts.keep)} label="Client/admin keep" />
        <Stat value={String(DATA.counts.uncertain)} label="Uncertain — do not delete" tone="warning" />
      </Grid>

      <Callout tone="success" title="Database integrity">
        Count before read {DATA.integrity.leaveCountBeforeRead}, after read {DATA.integrity.leaveCountAfterRead}. Writes performed: {DATA.integrity.writesPerformed}. Leave Management logic, payroll, employees, and schema were not changed.
      </Callout>

      <Callout tone="info" title="A. Our-side data — safe to delete: 0 records">
        No remaining row is both (1) proven to be created by importExcelLeaveMaster.js or syncLeaveFromExcel.js via the reason field, and (2) a near-duplicate of a genuine client/admin leave. The two Excel-import duplicates already removed earlier (Melvin Feb 2026 and Mehtab May–Jul 2026) are no longer in the database. importSource=excel-master-tracker alone is not treated as proof.
      </Callout>

      <Divider />

      <H2>Special validation — Melvin Abraham Thomas (IDMO-178)</H2>
      <Text tone="secondary">2 records remain. The Excel-import duplicate (2026-02-01 → 2026-02-15, reason Imported from Excel 2026) is already gone.</Text>
      <H3>Must keep — Melvin managed</H3>
      <Table
        headers={["ID", "Type", "Dates", "Days", "Reason", "Changed by", "Why keep"]}
        rows={melvinKeep.map((r) => [
          r.id,
          r.leaveType,
          r.startDate + " → " + r.endDate,
          String(r.leaveDays ?? ""),
          r.reason,
          r.changedBy || "",
          r.clientEvidence,
        ])}
        striped
        stickyHeader
      />
      <H3>Uncertain — do not delete</H3>
      <Text>
        Personal Leave 2026-01-31 → 2026-02-15 (ID 6a28031146c7ddf03d6da481). Reason is Personal, not a script import string. No createdBy/Melvin history. importSource is tagged excel-master-tracker, which is not reliable. Treat as genuine until proven otherwise.
      </Text>
      <Table
        headers={["ID", "Type", "Dates", "Reason", "importSource", "Created by", "Why uncertain"]}
        rows={melvinUncertain.map((r) => [
          r.id,
          r.leaveType,
          r.startDate + " → " + r.endDate,
          r.reason,
          r.importSource || "(empty)",
          r.createdBy || "(empty)",
          r.whyUncertain,
        ])}
        striped
      />

      <Divider />

      <H2>Special validation — Muhammad Mehtab (IDML-084)</H2>
      <Text tone="secondary">The Excel-import near-duplicate (2026-05-03 → 2026-07-06) is already gone. Genuine Annual Vacation remains.</Text>
      <H3>Must keep — managed by Melvin</H3>
      <Table
        headers={["ID", "Type", "Dates", "Reason", "Changed by", "Why keep"]}
        rows={mehtabKeep.map((r) => [
          r.id,
          r.leaveType,
          r.startDate + " → " + r.endDate,
          r.reason,
          r.changedBy || "",
          r.clientEvidence,
        ])}
        striped
      />
      <H3>Uncertain — script-imported history, no live duplicate</H3>
      <Table
        headers={["ID", "Employee", "Dates", "Days", "Reason", "Script"]}
        rows={mehtabUncertain.map((r) => [
          r.id,
          r.employeeName,
          r.startDate + " → " + r.endDate,
          String(r.leaveDays ?? ""),
          r.reason,
          r.scriptSource,
        ])}
        striped
      />

      <Divider />

      <H2>B / C — full classified lists</H2>
      <Text tone="secondary">
        Client actors used for KEEP: {DATA.clientUsernames.join(", ")}. Uncertain split: {DATA.uncertainScript} script-imported history with no live duplicate, {DATA.uncertainOther} live/other rows with no actor.
      </Text>
      <Row gap={8} wrap>
        <Pill active={tab === "keep"} onClick={() => setTab("keep")}>B. Keep ({DATA.counts.keep})</Pill>
        <Pill active={tab === "uncertain"} onClick={() => setTab("uncertain")}>C. Uncertain ({DATA.counts.uncertain})</Pill>
        <Pill active={tab === "employees"} onClick={() => setTab("employees")}>Employee-wise ({DATA.employeeWise.length})</Pill>
      </Row>
      <TextInput value={query} onChange={setQuery} placeholder="Filter by employee, ID, reason, or actor" />

      {tab === "keep" ? (
        <Stack gap={8}>
          <H3>B. Client / admin data — must keep ({keepRows.length} shown)</H3>
          <Table
            headers={["ID", "Emp ID", "Employee", "Type", "Start", "End", "Days", "Status", "Changed by", "Evidence"]}
            rows={keepRows.map((r) => [
              r.id,
              r.employeeId,
              r.employeeName,
              r.leaveType,
              r.startDate,
              r.endDate,
              r.leaveDays,
              r.status,
              r.changedBy,
              r.evidence,
            ])}
            striped
            stickyHeader
            style={{ maxHeight: 520 }}
          />
        </Stack>
      ) : null}

      {tab === "uncertain" ? (
        <Stack gap={8}>
          <H3>C. Uncertain — do not delete ({uncertainRows.length} shown)</H3>
          <Table
            headers={["ID", "Emp ID", "Employee", "Type", "Start", "End", "Reason", "Script", "Why"]}
            rows={uncertainRows.map((r) => [
              r.id,
              r.employeeId,
              r.employeeName,
              r.leaveType,
              r.startDate,
              r.endDate,
              r.reason,
              r.scriptSource || "",
              r.why,
            ])}
            striped
            stickyHeader
            style={{ maxHeight: 520 }}
          />
        </Stack>
      ) : null}

      {tab === "employees" ? (
        <Stack gap={8}>
          <H3>Employee-wise counts</H3>
          <Table
            headers={["Employee", "Our data (safe delete)", "Client/admin keep", "Uncertain"]}
            rows={empRows.map((r) => [r.employee, String(r.our), String(r.keep), String(r.uncertain)])}
            striped
            stickyHeader
            style={{ maxHeight: 520 }}
          />
        </Stack>
      ) : null}

      <Text tone="secondary">
        Exact duplicates remaining: {DATA.counts.exactDuplicates}. Possible near-duplicates remaining: {DATA.counts.possibleDuplicates}. Full JSON: server/scratch/leaveAuditFull.json
      </Text>
    </Stack>
  );
}
`;

const out = path.join(
  "C:/Users/Digi Ideacentre/.cursor/projects/c-Users-Digi-Ideacentre-Documents-sonashi-Sonashi-HRMS/canvases",
  "leave-management-audit.canvas.tsx"
);
fs.writeFileSync(out, tsx);
console.log("wrote", out, "bytes", tsx.length);
