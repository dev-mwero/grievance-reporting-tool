import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { transportSendMock } = vi.hoisted(() => ({
  transportSendMock: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: transportSendMock }),
  },
}));

const ctx = {
  grievanceId: "65f0000000000000000000aa",
  referenceCode: "GRV-2026-0001",
  categoryName: "Roads & Infrastructure",
  subCountyName: "Nairobi West",
  wardName: "Kangemi",
};

async function loadEmailModule(smtpHost: string) {
  vi.resetModules();
  vi.stubEnv("SMTP_HOST", smtpHost);
  vi.stubEnv("APP_URL", "https://gripo.example.co.ke");
  return await import("@/server/email");
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  transportSendMock.mockReset();
  transportSendMock.mockResolvedValue({ messageId: "1" });
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  vi.unstubAllEnvs();
});

describe("sendGrievanceSubmittedEmail", () => {
  it("emails the reference code, category, location and a dashboard link", async () => {
    const { sendGrievanceSubmittedEmail } = await loadEmailModule("smtp.test");

    const sent = await sendGrievanceSubmittedEmail("admin@gov.go.ke", ctx);

    expect(sent).toBe(true);
    expect(transportSendMock).toHaveBeenCalledTimes(1);

    const arg = transportSendMock.mock.calls[0][0];
    expect(arg.to).toBe("admin@gov.go.ke");
    expect(arg.subject).toBe("New grievance submitted: GRV-2026-0001");
    expect(arg.text).toContain("GRV-2026-0001");
    expect(arg.text).toContain("Roads & Infrastructure");
    expect(arg.text).toContain("Kangemi, Nairobi West");
    expect(arg.html).toContain(
      "https://gripo.example.co.ke/dashboard/grievances/65f0000000000000000000aa",
    );
  });

  it("never includes the complaint description", async () => {
    const { sendGrievanceSubmittedEmail } = await loadEmailModule("smtp.test");

    await sendGrievanceSubmittedEmail("admin@gov.go.ke", ctx);

    const arg = transportSendMock.mock.calls[0][0];
    expect(arg.text).not.toContain("description");
    expect(arg.html).not.toContain("description");
  });
});

describe("sendGrievanceAssignedEmail", () => {
  it("tells a primary assignee they are the primary assignee", async () => {
    const { sendGrievanceAssignedEmail } = await loadEmailModule("smtp.test");

    const sent = await sendGrievanceAssignedEmail("officer@gov.go.ke", {
      ...ctx,
      assignedByName: "Jane Admin",
      isPrimary: true,
    });

    expect(sent).toBe(true);
    const arg = transportSendMock.mock.calls[0][0];
    expect(arg.subject).toBe("Grievance GRV-2026-0001 assigned to you");
    expect(arg.text).toContain("Jane Admin");
    expect(arg.text).toContain("primary assignee");
  });

  it("tells a supporting assignee they are supporting", async () => {
    const { sendGrievanceAssignedEmail } = await loadEmailModule("smtp.test");

    await sendGrievanceAssignedEmail("support@gov.go.ke", {
      ...ctx,
      assignedByName: "Jane Admin",
      isPrimary: false,
    });

    const arg = transportSendMock.mock.calls[0][0];
    expect(arg.text).toContain("supporting assignee");
  });

  it("escapes HTML in interpolated values", async () => {
    const { sendGrievanceAssignedEmail } = await loadEmailModule("smtp.test");

    await sendGrievanceAssignedEmail("officer@gov.go.ke", {
      ...ctx,
      categoryName: '<script>alert("x")</script>',
      assignedByName: "<b>Admin</b>",
      isPrimary: true,
    });

    const arg = transportSendMock.mock.calls[0][0];
    expect(arg.html).not.toContain("<script>");
    expect(arg.html).not.toContain("<b>Admin</b>");
    expect(arg.html).toContain("&lt;script&gt;");
  });
});

describe("email delivery is non-fatal", () => {
  it("returns false instead of throwing when the transport rejects", async () => {
    const { sendGrievanceSubmittedEmail } = await loadEmailModule("smtp.test");
    transportSendMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      sendGrievanceSubmittedEmail("admin@gov.go.ke", ctx),
    ).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns false and logs when SMTP is not configured", async () => {
    const { sendGrievanceAssignedEmail } = await loadEmailModule("");

    const sent = await sendGrievanceAssignedEmail("officer@gov.go.ke", {
      ...ctx,
      assignedByName: "Jane Admin",
      isPrimary: true,
    });

    expect(sent).toBe(false);
    expect(transportSendMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});
