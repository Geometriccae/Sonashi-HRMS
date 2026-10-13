/**
 * Pending leave approval email — offline checks with a fake SMTP transporter.
 *   node scratch/verify_pending_leave_email.js
 */
const assert = require("assert");
const {
  DEFAULT_PENDING_LEAVE_RECIPIENTS,
  getPendingLeaveRecipients,
  buildPendingLeaveEmail,
  sendPendingLeaveNotification,
} = require("../services/pendingLeaveEmailService");

const fakeTransporter = ({ failFor = [] } = {}) => {
  const sent = [];
  return {
    sent,
    sendMail: async (msg) => {
      if (failFor.includes(msg.to)) throw new Error("SMTP connection refused");
      sent.push(msg);
      return { messageId: `${sent.length}` };
    },
  };
};

const pendingLeave = (overrides = {}) => ({
  _id: "66f000000000000000000001",
  employeeName: "Ravi <Kumar>",
  employeeId: "IDMM-101",
  department: "Sales",
  reportingManager: "Anil",
  leaveType: "Annual Leave",
  startDate: new Date(2026, 9, 5),
  endDate: new Date(2026, 9, 15),
  leaveDays: 10,
  status: "Pending",
  appliedOn: new Date(2026, 9, 2),
  emiratesId: "784-0000-0000000-0",
  ...overrides,
});

(async () => {
  delete process.env.LEAVE_PENDING_NOTIFY_EMAILS;
  process.env.FRONTEND_URL = "https://hrms.example.com/";

  // Test 1: new pending request → both approvers, with the required details
  const t1 = fakeTransporter();
  const r1 = await sendPendingLeaveNotification(pendingLeave(), { transporter: t1, from: "hr@example.com" });
  assert.deepStrictEqual(r1.sent, ["mahesh@sonashi.ae", "kailash@sonashi.ae"]);
  assert.strictEqual(t1.sent.length, 2);
  const { subject, html } = t1.sent[0];
  assert.ok(subject.includes("Pending Leave Approval") && subject.includes("IDMM-101"));
  [
    "An employee leave request is pending for approval.",
    "Ravi &lt;Kumar&gt;", // HTML-escaped
    "IDMM-101",
    "Annual Leave",
    "05 Oct 2026",
    "15 Oct 2026",
    "10 days",
    "Pending",
    "Anil",
    "66f000000000000000000001",
    "https://hrms.example.com/leave-requests",
    "View Leave Request",
  ].forEach((text) => assert.ok(html.includes(text), `email contains ${text}`));
  assert.ok(!html.includes("<Kumar>"), "user text is escaped");
  assert.ok(!html.includes("784-0000"), "no unnecessary personal data");
  console.log("PASS Test 1: new pending leave emails Mahesh and Kailash");

  // Test 3 / 4: approved, rejected, cancelled records are never sent as pending
  for (const status of ["Approved", "HOD Approved", "Rejected", "Cancelled"]) {
    const t = fakeTransporter();
    const r = await sendPendingLeaveNotification(pendingLeave({ status }), { transporter: t });
    assert.strictEqual(t.sent.length, 0, `${status} not sent`);
    assert.strictEqual(r.skipped, "not pending");
  }
  console.log("PASS Test 3/4: approved/rejected/cancelled leave is not treated as pending");

  // Test 5: each employee's new pending request gets its own notification
  const t5 = fakeTransporter();
  const leaves = [
    pendingLeave({ _id: "a1", employeeName: "Emp A", employeeId: "IDMM-201" }),
    pendingLeave({ _id: "b2", employeeName: "Emp B", employeeId: "IDMM-202" }),
    pendingLeave({ _id: "c3", employeeName: "Emp C", employeeId: "IDMM-203" }),
  ];
  for (const leave of leaves) await sendPendingLeaveNotification(leave, { transporter: t5 });
  assert.strictEqual(t5.sent.length, 6);
  ["IDMM-201", "IDMM-202", "IDMM-203"].forEach((code) =>
    assert.strictEqual(t5.sent.filter((m) => m.subject.includes(code)).length, 2)
  );
  console.log("PASS Test 5: multiple employees → one notification per request per approver");

  // Test 6: SMTP failure is logged and never throws (leave save is unaffected)
  const t6 = fakeTransporter({ failFor: ["mahesh@sonashi.ae"] });
  const r6 = await sendPendingLeaveNotification(pendingLeave(), { transporter: t6 });
  assert.deepStrictEqual(r6.failed, ["mahesh@sonashi.ae"]);
  assert.deepStrictEqual(r6.sent, ["kailash@sonashi.ae"]);
  const r6b = await sendPendingLeaveNotification(pendingLeave(), { transporter: null });
  assert.strictEqual(r6b.skipped, "no transporter");
  console.log("PASS Test 6: email failure / missing SMTP config is logged, not thrown");

  // Recipients are configurable without code changes
  process.env.LEAVE_PENDING_NOTIFY_EMAILS = "Mahesh@sonashi.ae, kailash@sonashi.ae; mahesh@sonashi.ae";
  assert.deepStrictEqual(getPendingLeaveRecipients(), ["mahesh@sonashi.ae", "kailash@sonashi.ae"]);
  process.env.LEAVE_PENDING_NOTIFY_EMAILS = "not-an-email";
  assert.deepStrictEqual(getPendingLeaveRecipients(), DEFAULT_PENDING_LEAVE_RECIPIENTS);
  delete process.env.FRONTEND_URL;
  assert.ok(!buildPendingLeaveEmail(pendingLeave()).html.includes("href="), "no link without FRONTEND_URL");
  console.log("PASS recipients config + link only when FRONTEND_URL is set");

  console.log("\nAll pending leave email checks passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
