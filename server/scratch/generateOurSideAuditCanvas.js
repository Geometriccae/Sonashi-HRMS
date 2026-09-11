const fs = require("fs");
const path = require("path");
const d = require("./leaveOurSideAudit.json");

const compactDel = d.delete.map((r) => ({
  id: r.id,
  employeeId: r.employeeId || "",
  employeeName: r.employeeName || "",
  leaveType: r.leaveType || "",
  startDate: r.startDate,
  endDate: r.endDate,
  leaveDays: r.leaveDays === "" || r.leaveDays == null ? "" : String(r.leaveDays),
  reason: r.reason || "",
  importSource: r.importSource || "",
  createdBy: r.createdBy || "",
  changedBy: r.changedBy || "",
  approvedBy: r.adminApprovedBy || "",
  createdAt: r.createdAt || "",
  scriptSource: r.scriptSource,
  evidence: r.evidence,
  confidence: r.confidence,
}));
const compactKeep = d.keep.map((r) => ({
  id: r.id,
  employeeId: r.employeeId || "",
  employeeName: r.employeeName || "",
  leaveType: r.leaveType || "",
  startDate: r.startDate,
  endDate: r.endDate,
  leaveDays: r.leaveDays === "" || r.leaveDays == null ? "" : String(r.leaveDays),
  status: r.status || "",
  reason: r.reason || "",
  createdBy: r.createdBy || "",
  changedBy: r.changedBy || "",
  approvedBy: r.adminApprovedBy || "",
  evidence: r.whyKeep || r.evidence || "",
}));
const compactUnc = d.uncertain.map((r) => ({
  id: r.id,
  employeeId: r.employeeId || "",
  employeeName: r.employeeName || "",
  leaveType: r.leaveType || "",
  startDate: r.startDate,
  endDate: r.endDate,
  reason: r.reason || "",
  importSource: r.importSource || "",
  createdBy: r.createdBy || "",
  scriptSource: r.scriptSource || "",
  why: r.whyUncertain || "",
}));

const payload = {
  generatedAt: d.generatedAt,
  integrity: d.integrity,
  counts: d.counts,
  workflowUsers: d.workflowUsers,
  seedAdmins: d.seedAdmins,
  users: d.users,
  delete: compactDel,
  keep: compactKeep,
  uncertain: compactUnc,
  employeeWise: d.employeeWise,
  deleteByScript: compactDel.reduce((a, r) => {
    a[r.scriptSource] = (a[r.scriptSource] || 0) + 1;
    return a;
  }, {}),
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

const DATA = ${json};

function blob(r: Record<string, string>) {
  return Object.values(r).join(" ").toLowerCase();
}

export default function LeaveOurSideAudit() {
  const [tab, setTab] = useCanvasState<"delete" | "keep" | "uncertain" | "employees">("tab", "delete");
  const [q, setQ] = useCanvasState("q", "");
  const query = q.trim().toLowerCase();
  const filt = <T extends Record<string, string>>(rows: T[]) =>
    query ? rows.filter((r) => blob(r).includes(query)) : rows;

  const del = filt(DATA.delete);
  const keep = filt(DATA.keep);
  const unc = filt(DATA.uncertain);
  const emp = query
    ? DATA.employeeWise.filter((r: { employee: string }) => r.employee.toLowerCase().includes(query))
    : DATA.employeeWise;

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <H1>Leave Management our-side audit</H1>
        <Text tone="secondary">
          Read-only. Generated {DATA.generatedAt}. No records were deleted, updated, or inserted.
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(DATA.counts.total)} label="Total records" />
        <Stat value={String(DATA.counts.delete)} label="DELETE — our side (HIGH)" tone="danger" />
        <Stat value={String(DATA.counts.keep)} label="KEEP — client/admin" tone="success" />
        <Stat value={String(DATA.counts.uncertain)} label="UNCERTAIN — do not delete" tone="warning" />
      </Grid>

      <Callout tone="success" title="Integrity">
        Count before read {DATA.integrity.leaveCountBeforeRead}, after read {DATA.integrity.leaveCountAfterRead}. Writes: {DATA.integrity.writesPerformed}.
      </Callout>

      <Callout tone="info" title="How DELETE was proven">
        HIGH-confidence DELETE requires a script-written reason from importExcelLeaveMaster.js or syncLeaveFromExcel.js, and no later action by a live leave-operator account (User role admin / authorize_user / HR / HOD excluding the seed account admin@sonashi.com). importSource alone is not proof. Seed admin activity is not assumed to be ours or the client's. Duplicate matching was not required.
      </Callout>

      <H2>Operator accounts (from User collection)</H2>
      <Table
        headers={["Username", "Role", "Email", "Classification"]}
        rows={DATA.users.map((u: { username: string; role: string; emailId: string; class: string }) => [
          u.username,
          u.role,
          u.emailId || "(empty)",
          u.class,
        ])}
        striped
      />

      <Divider />

      <H2>Melvin Abraham Thomas (IDMO-178)</H2>
      <Text>
        Both remaining Melvin leaves are KEEP. None are on the DELETE list. The earlier Excel-import duplicate (2026-02-01 → 2026-02-15) is already gone.
      </Text>
      <Table
        headers={["ID", "Type", "Dates", "Reason", "Changed by", "Class"]}
        rows={[
          ["6a28031146c7ddf03d6da481", "Personal Leave", "2026-01-31 → 2026-02-15", "Personal", "(empty)", "KEEP"],
          ["6a28038146c7ddf03d6da490", "Annual Leave", "2026-06-20 → 2026-08-05", "Annual Vacation", "Melvin", "KEEP"],
        ]}
        striped
      />

      <H2>Muhammad Mehtab (IDML-084)</H2>
      <Text>
        Genuine Annual Vacation 2026-05-04 → 2026-07-06 is KEEP (managed by Melvin). Script-imported history rows with no operator history are on DELETE.
      </Text>

      <Divider />

      <Row gap={8} wrap>
        <Pill active={tab === "delete"} onClick={() => setTab("delete")}>A. DELETE ({DATA.counts.delete})</Pill>
        <Pill active={tab === "keep"} onClick={() => setTab("keep")}>B. KEEP ({DATA.counts.keep})</Pill>
        <Pill active={tab === "uncertain"} onClick={() => setTab("uncertain")}>C. UNCERTAIN ({DATA.counts.uncertain})</Pill>
        <Pill active={tab === "employees"} onClick={() => setTab("employees")}>Employees</Pill>
      </Row>
      <TextInput value={q} onChange={setQ} placeholder="Filter by employee, ID, reason, script, or actor" />

      {tab === "delete" ? (
        <Stack gap={8}>
          <H3>A. DELETE — our-side data, HIGH confidence ({del.length} shown)</H3>
          <Text tone="secondary">
            {DATA.deleteByScript["syncLeaveFromExcel.js"] || 0} from syncLeaveFromExcel.js; {DATA.deleteByScript["importExcelLeaveMaster.js"] || 0} from importExcelLeaveMaster.js.
          </Text>
          <Table
            headers={["ID", "Emp ID", "Employee", "Type", "Start", "End", "Days", "Reason", "Script", "Confidence"]}
            rows={del.map((r: { id: string; employeeId: string; employeeName: string; leaveType: string; startDate: string; endDate: string; leaveDays: string; reason: string; scriptSource: string; confidence: string }) => [
              r.id,
              r.employeeId,
              r.employeeName,
              r.leaveType,
              r.startDate,
              r.endDate,
              r.leaveDays,
              r.reason,
              r.scriptSource,
              r.confidence,
            ])}
            striped
            stickyHeader
            style={{ maxHeight: 540 }}
          />
        </Stack>
      ) : null}

      {tab === "keep" ? (
        <Stack gap={8}>
          <H3>B. KEEP — client/admin ({keep.length} shown)</H3>
          <Table
            headers={["ID", "Emp ID", "Employee", "Type", "Start", "End", "Status", "Changed by", "Why keep"]}
            rows={keep.map((r: { id: string; employeeId: string; employeeName: string; leaveType: string; startDate: string; endDate: string; status: string; changedBy: string; evidence: string }) => [
              r.id,
              r.employeeId,
              r.employeeName,
              r.leaveType,
              r.startDate,
              r.endDate,
              r.status,
              r.changedBy,
              r.evidence,
            ])}
            striped
            stickyHeader
            style={{ maxHeight: 540 }}
          />
        </Stack>
      ) : null}

      {tab === "uncertain" ? (
        <Stack gap={8}>
          <H3>C. UNCERTAIN — do not delete ({unc.length} shown)</H3>
          <Table
            headers={["ID", "Emp ID", "Employee", "Type", "Start", "End", "Reason", "Why"]}
            rows={unc.map((r: { id: string; employeeId: string; employeeName: string; leaveType: string; startDate: string; endDate: string; reason: string; why: string }) => [
              r.id,
              r.employeeId,
              r.employeeName,
              r.leaveType,
              r.startDate,
              r.endDate,
              r.reason,
              r.why,
            ])}
            striped
            stickyHeader
            style={{ maxHeight: 540 }}
          />
        </Stack>
      ) : null}

      {tab === "employees" ? (
        <Stack gap={8}>
          <H3>Employee-wise counts</H3>
          <Table
            headers={["Employee", "DELETE", "KEEP", "UNCERTAIN"]}
            rows={emp.map((r: { employee: string; del: number; keep: number; uncertain: number }) => [
              r.employee,
              String(r.del),
              String(r.keep),
              String(r.uncertain),
            ])}
            striped
            stickyHeader
            style={{ maxHeight: 540 }}
          />
        </Stack>
      ) : null}

      <Text tone="secondary">Full JSON with history and evidence: server/scratch/leaveOurSideAudit.json. No deletion will run until you approve list A.</Text>
    </Stack>
  );
}
`;

const out = path.join(
  "C:/Users/Digi Ideacentre/.cursor/projects/c-Users-Digi-Ideacentre-Documents-sonashi-Sonashi-HRMS/canvases",
  "leave-our-side-audit.canvas.tsx"
);
fs.writeFileSync(out, tsx);
console.log("wrote", out, tsx.length);
