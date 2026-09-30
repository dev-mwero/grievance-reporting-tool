import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/types";

const h = vi.hoisted(() => ({
  grievanceFindById: vi.fn(),
  requestFindById: vi.fn(),
  attachmentCountDocuments: vi.fn(),
  attachmentInsertMany: vi.fn(),
  attachmentFind: vi.fn(),
  attachmentFindById: vi.fn(),
  attachmentDeleteOne: vi.fn(),
  pendingFindOneAndUpdate: vi.fn(),
  pendingFindOne: vi.fn(),
  pendingUpdateMany: vi.fn(),
  generateSignedURL: vi.fn(),
  deleteFiles: vi.fn(),
}));

vi.mock("@/server/models/grievance.model", () => ({
  Grievance: { findById: h.grievanceFindById },
}));
vi.mock("@/server/models/grievance-transition-request.model", () => ({
  TransitionRequest: { findById: h.requestFindById },
}));
vi.mock("@/server/models/attachment.model", () => ({
  Attachment: {
    countDocuments: h.attachmentCountDocuments,
    insertMany: h.attachmentInsertMany,
    find: h.attachmentFind,
    findById: h.attachmentFindById,
    deleteOne: h.attachmentDeleteOne,
  },
  ALLOWED_CONTENT_TYPES: new Set(["image/png", "application/pdf"]),
  MAX_ATTACHMENTS_PER_GRIEVANCE: 10,
  MAX_ATTACHMENT_BYTES: 8 * 1024 * 1024,
}));
vi.mock("@/server/models/attachment-upload.model", () => ({
  PendingUpload: {
    findOneAndUpdate: h.pendingFindOneAndUpdate,
    findOne: h.pendingFindOne,
    updateMany: h.pendingUpdateMany,
  },
}));

// UTApi is constructed at import time, so it has to be mocked before the service
// module loads — the real one would demand a token and hit the network.
vi.mock("uploadthing/server", () => ({
  UTApi: class {
    generateSignedURL = h.generateSignedURL;
    deleteFiles = h.deleteFiles;
  },
}));

import {
  attachToGrievance,
  countFor,
  getSignedUrl,
  listWithSignedUrls,
  removeAttachment,
} from "@/server/services/attachments.service";

const GRIEVANCE_ID = "64b7f0000000000000000c01";
const ATTACHMENT_ID = "64b7f0000000000000000c02";
const STAFF_ID = "64b7f0000000000000000c03";
const OTHER_STAFF_ID = "64b7f0000000000000000c04";

const ADMIN = { userId: STAFF_ID, name: "Admin", role: Role.ADMIN };
const STAFF = { userId: STAFF_ID, role: Role.STAFF };

function fakeGrievance(over: Record<string, unknown> = {}) {
  return {
    _id: GRIEVANCE_ID,
    referenceCode: "GRV-2026-CCDDEEFF",
    primaryAssigneeId: { toString: () => STAFF_ID },
    supportingAssignees: [],
    deletedAt: null,
    ...over,
  };
}

/** A `findById` that returns a full document, as the service expects. */
function mockGrievance(over: Record<string, unknown> = {}) {
  const doc = fakeGrievance(over);
  h.grievanceFindById.mockResolvedValue(doc);
  return doc;
}

/** A `findById(...).lean()` chain, as the read paths use. */
function mockLeanGrievance(over: Record<string, unknown> = {}) {
  h.grievanceFindById.mockReturnValue({
    select: () => ({ lean: async () => fakeGrievance(over) }),
  });
}

function pendingUpload(over: Record<string, unknown> = {}) {
  return {
    fileKey: "abc/evidence.png",
    name: "evidence.png",
    size: 1024,
    contentType: "image/png",
    uploadedBy: { toString: () => STAFF_ID },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.attachmentCountDocuments.mockResolvedValue(0);
  h.attachmentInsertMany.mockResolvedValue([]);
  h.generateSignedURL.mockResolvedValue({
    ufsUrl: "https://files.example/signed/abc",
  });
  h.deleteFiles.mockResolvedValue({});
  h.pendingUpdateMany.mockResolvedValue({});
  h.attachmentDeleteOne.mockResolvedValue({});
});

describe("attaching an uploaded file", () => {
  it("records the claim and returns the attachment", async () => {
    mockGrievance();
    h.pendingFindOneAndUpdate.mockResolvedValue(pendingUpload());

    await attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
      userId: STAFF_ID,
      name: "Staff",
      role: Role.STAFF,
    });

    expect(h.attachmentInsertMany).toHaveBeenCalledOnce();
    // The stored record carries the server's own view of the file, not the
    // client's claim about it.
    expect(h.attachmentInsertMany.mock.calls[0][0][0]).toMatchObject({
      name: "evidence.png",
      size: 1024,
      contentType: "image/png",
    });
  });

  // A key is a client-supplied string. Without an ownership check a caller could
  // attach evidence uploaded under a different account.
  it("rejects a key this account never uploaded", async () => {
    mockGrievance();
    h.pendingFindOneAndUpdate.mockResolvedValue(null);
    h.pendingFindOne.mockResolvedValue(null);

    await expect(
      attachToGrievance(GRIEVANCE_ID, [{ fileKey: "someone-elses/key.png" }], {
        userId: STAFF_ID,
        name: "Staff",
        role: Role.STAFF,
      }),
    ).rejects.toThrow(/not uploaded by this account/);
    expect(h.attachmentInsertMany).not.toHaveBeenCalled();
  });

  it("rejects a key already claimed by another complaint", async () => {
    mockGrievance();
    h.pendingFindOneAndUpdate.mockResolvedValue(null);
    h.pendingFindOne.mockResolvedValue(pendingUpload());

    await expect(
      attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
        userId: STAFF_ID,
        name: "Staff",
        role: Role.STAFF,
      }),
    ).rejects.toThrow(/already attached/);
    expect(h.attachmentInsertMany).not.toHaveBeenCalled();
  });

  // The type is checked against the app's allow-list, not the client's word.
  it("rejects a disallowed content type", async () => {
    mockGrievance();
    h.pendingFindOneAndUpdate.mockResolvedValue(
      pendingUpload({ contentType: "application/x-msdownload" }),
    );

    await expect(
      attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
        userId: STAFF_ID,
        name: "Staff",
        role: Role.STAFF,
      }),
    ).rejects.toThrow(/Unsupported file type/);
    expect(h.attachmentInsertMany).not.toHaveBeenCalled();
  });

  it("rejects a file over the size cap", async () => {
    mockGrievance();
    h.pendingFindOneAndUpdate.mockResolvedValue(
      pendingUpload({ size: 9 * 1024 * 1024 }),
    );

    await expect(
      attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
        userId: STAFF_ID,
        name: "Staff",
        role: Role.STAFF,
      }),
    ).rejects.toThrow(/under 8MB/);
    expect(h.attachmentInsertMany).not.toHaveBeenCalled();
  });

  // A partially failed batch must not leave some files claimed and unattached —
  // those uploads would be unreclaimable and the user could not retry.
  it("releases the claim when the insert fails", async () => {
    mockGrievance();
    h.pendingFindOneAndUpdate.mockResolvedValue(pendingUpload());
    h.attachmentInsertMany.mockRejectedValue(new Error("write failed"));

    await expect(
      attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
        userId: STAFF_ID,
        name: "Staff",
        role: Role.STAFF,
      }),
    ).rejects.toThrow("write failed");
    expect(h.pendingUpdateMany).toHaveBeenCalledOnce();
  });

  it("caps the number of attachments on one complaint", async () => {
    mockGrievance();
    h.attachmentCountDocuments.mockResolvedValue(10);

    await expect(
      attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
        userId: STAFF_ID,
        name: "Staff",
        role: Role.STAFF,
      }),
    ).rejects.toThrow(/at most 10 attachments/);
  });

  it("refuses to attach to a deleted complaint", async () => {
    mockGrievance({ deletedAt: new Date() });

    await expect(
      attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
        userId: STAFF_ID,
        name: "Staff",
        role: Role.STAFF,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("refuses a proposal id belonging to another complaint", async () => {
    mockGrievance();
    h.requestFindById.mockResolvedValue({
      grievanceId: { toString: () => "64b7f0000000000000000fff" },
      status: "PENDING",
    });

    await expect(
      attachToGrievance(
        GRIEVANCE_ID,
        [{ fileKey: "abc/evidence.png" }],
        { userId: STAFF_ID, name: "Staff", role: Role.STAFF },
        { transitionRequestId: "64b7f0000000000000000c09" },
      ),
    ).rejects.toThrow(/does not belong to this complaint/);
  });

  it("refuses evidence for a proposal that was already decided", async () => {
    mockGrievance();
    h.requestFindById.mockResolvedValue({
      grievanceId: { toString: () => GRIEVANCE_ID },
      status: "APPROVED",
    });

    await expect(
      attachToGrievance(
        GRIEVANCE_ID,
        [{ fileKey: "abc/evidence.png" }],
        { userId: STAFF_ID, name: "Staff", role: Role.STAFF },
        { transitionRequestId: "64b7f0000000000000000c09" },
      ),
    ).rejects.toThrow(/already been decided/);
  });
});

describe("attachment authorisation", () => {
  it("refuses staff who are not assigned to the complaint", async () => {
    mockGrievance();

    await expect(
      attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
        userId: OTHER_STAFF_ID,
        name: "Other",
        role: Role.STAFF,
      }),
    ).rejects.toThrow(/only attach evidence to complaints assigned to you/);
    expect(h.pendingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("allows a supporting assignee", async () => {
    mockGrievance({
      primaryAssigneeId: { toString: () => OTHER_STAFF_ID },
      supportingAssignees: [{ toString: () => STAFF_ID }],
    });
    h.pendingFindOneAndUpdate.mockResolvedValue(pendingUpload());

    await attachToGrievance(GRIEVANCE_ID, [{ fileKey: "abc/evidence.png" }], {
      userId: STAFF_ID,
      name: "Staff",
      role: Role.STAFF,
    });

    expect(h.attachmentInsertMany).toHaveBeenCalledOnce();
  });

  it("lets an admin touch a complaint assigned to someone else", async () => {
    mockGrievance({
      primaryAssigneeId: { toString: () => OTHER_STAFF_ID },
      supportingAssignees: [],
    });
    h.pendingFindOneAndUpdate.mockResolvedValue(pendingUpload());

    await attachToGrievance(
      GRIEVANCE_ID,
      [{ fileKey: "abc/evidence.png" }],
      ADMIN,
    );

    expect(h.attachmentInsertMany).toHaveBeenCalledOnce();
  });
});

describe("reading evidence", () => {
  it("signs a URL per file and never exposes the raw key", async () => {
    mockLeanGrievance();
    h.attachmentFind.mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            _id: { toString: () => ATTACHMENT_ID },
            name: "evidence.png",
            size: 1024,
            contentType: "image/png",
            uploadedByName: "Staff",
            createdAt: new Date("2026-01-01"),
            fileKey: "abc/evidence.png",
          },
        ],
      }),
    });

    const result = await listWithSignedUrls(GRIEVANCE_ID, STAFF);

    expect(result[0].url).toBe("https://files.example/signed/abc");
    expect(h.generateSignedURL).toHaveBeenCalledWith(
      "abc/evidence.png",
      expect.objectContaining({ expiresIn: "10m" }),
    );
    expect(JSON.stringify(result)).not.toContain("abc/evidence.png");
  });

  it("refuses to sign a URL for an unassigned staff member", async () => {
    mockLeanGrievance({
      primaryAssigneeId: { toString: () => OTHER_STAFF_ID },
    });
    h.attachmentFind.mockReturnValue({
      sort: () => ({ lean: async () => [] }),
    });

    await expect(
      listWithSignedUrls(GRIEVANCE_ID, {
        userId: STAFF_ID,
        role: Role.STAFF,
      }),
    ).rejects.toThrow(/only attach evidence to complaints assigned to you/);
    expect(h.generateSignedURL).not.toHaveBeenCalled();
  });

  it("reports a key whose file has left storage instead of returning a dead link", async () => {
    mockLeanGrievance();
    h.attachmentFind.mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            _id: { toString: () => ATTACHMENT_ID },
            name: "gone.png",
            size: 10,
            contentType: "image/png",
            uploadedByName: "Staff",
            createdAt: new Date(),
            fileKey: "abc/gone.png",
          },
        ],
      }),
    });
    h.generateSignedURL.mockRejectedValue(new Error("NoSuchKey"));

    await expect(listWithSignedUrls(GRIEVANCE_ID, STAFF)).rejects.toThrow(
      /no longer available in storage/,
    );
  });

  it("signs a single attachment through the same authorisation check", async () => {
    mockLeanGrievance();
    h.attachmentFindById.mockReturnValue({
      lean: async () => ({
        _id: { toString: () => ATTACHMENT_ID },
        name: "evidence.png",
        fileKey: "abc/evidence.png",
        grievanceId: GRIEVANCE_ID,
      }),
    });

    const result = await getSignedUrl(ATTACHMENT_ID, STAFF);

    expect(result.url).toBe("https://files.example/signed/abc");
  });

  it("counts evidence without signing anything", async () => {
    mockLeanGrievance();
    h.attachmentCountDocuments.mockResolvedValue(3);

    await expect(countFor(GRIEVANCE_ID, STAFF)).resolves.toBe(3);
    expect(h.generateSignedURL).not.toHaveBeenCalled();
  });

  // Counting is still a read of someone else's case, so it takes the same check
  // as fetching the evidence itself.
  it("refuses to count evidence for an unassigned staff member", async () => {
    mockLeanGrievance({
      primaryAssigneeId: { toString: () => OTHER_STAFF_ID },
    });

    await expect(countFor(GRIEVANCE_ID, STAFF)).rejects.toThrow(
      /only attach evidence to complaints assigned to you/,
    );
    expect(h.attachmentCountDocuments).not.toHaveBeenCalled();
  });
});

describe("removing evidence", () => {
  it("lets the uploader remove their own file and deletes it from storage", async () => {
    h.attachmentFindById.mockResolvedValue({
      _id: ATTACHMENT_ID,
      fileKey: "abc/evidence.png",
      uploadedBy: { toString: () => STAFF_ID },
      grievanceId: GRIEVANCE_ID,
    });
    mockLeanGrievance();

    await removeAttachment(ATTACHMENT_ID, STAFF);

    expect(h.attachmentDeleteOne).toHaveBeenCalledOnce();
    expect(h.deleteFiles).toHaveBeenCalledWith("abc/evidence.png");
  });

  it("refuses staff removing evidence they did not upload", async () => {
    h.attachmentFindById.mockResolvedValue({
      _id: ATTACHMENT_ID,
      fileKey: "abc/evidence.png",
      uploadedBy: { toString: () => OTHER_STAFF_ID },
      grievanceId: GRIEVANCE_ID,
    });
    mockLeanGrievance();

    await expect(removeAttachment(ATTACHMENT_ID, STAFF)).rejects.toThrow(
      /only remove evidence you uploaded/,
    );
    expect(h.attachmentDeleteOne).not.toHaveBeenCalled();
  });

  it("lets an admin remove anyone's evidence", async () => {
    h.attachmentFindById.mockResolvedValue({
      _id: ATTACHMENT_ID,
      fileKey: "abc/evidence.png",
      uploadedBy: { toString: () => OTHER_STAFF_ID },
      grievanceId: GRIEVANCE_ID,
    });
    mockLeanGrievance();

    await removeAttachment(ATTACHMENT_ID, ADMIN);

    expect(h.attachmentDeleteOne).toHaveBeenCalledOnce();
  });

  // The row is already gone at this point, so a storage failure must not leave
  // the app serving a record that resolves to nothing.
  it("keeps the row deleted even when the storage delete fails", async () => {
    h.attachmentFindById.mockResolvedValue({
      _id: ATTACHMENT_ID,
      fileKey: "abc/evidence.png",
      uploadedBy: { toString: () => STAFF_ID },
      grievanceId: GRIEVANCE_ID,
    });
    mockLeanGrievance();
    h.deleteFiles.mockRejectedValue(new Error("storage down"));

    await expect(removeAttachment(ATTACHMENT_ID, STAFF)).resolves.toBeDefined();
    expect(h.attachmentDeleteOne).toHaveBeenCalledOnce();
  });
});
