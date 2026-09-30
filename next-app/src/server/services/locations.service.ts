import { ApiError } from "../api-error";
import { type DeletionScope, deletionFilter } from "../models/soft-delete";
import { type ISubCounty, SubCounty } from "../models/sub-county.model";
import { type IWard, Ward } from "../models/ward.model";
import { AuditAction } from "./audit.service";
import { logSubCountyEvent, logWardEvent } from "./audit-impl";
import {
  type DeletionActor,
  type DeletionHooks,
  type DeletionTarget,
  purgeRecord,
  restoreRecord,
  softDeleteRecord,
} from "./deletion.service";

// ═══ Sub-Counties ═══════════════════════════════════════════════════════════

const subCountyTarget: DeletionTarget<ISubCounty> = {
  label: "Sub-County",
  entityType: "SubCounty",
  model: SubCounty,
};

const subCountyActions = {
  softDelete: AuditAction.SUBCOUNTY_SOFT_DELETED,
  restore: AuditAction.SUBCOUNTY_RESTORED,
  purge: AuditAction.SUBCOUNTY_PURGED,
};

const subCountyHooks: DeletionHooks<ISubCounty> = {
  beforeSoftDelete: (doc) => {
    doc.isActive = false;
  },
  beforeRestore: (doc) => {
    doc.isActive = true;
  },
  // A ward cannot exist without its sub-county, so purging one with live wards
  // is blocked. Wards that are themselves already soft-deleted carry no
  // operational meaning, so they are swept up by the cascade instead.
  beforePurge: async (doc) => {
    const liveWards = await Ward.countDocuments({
      subCountyId: doc._id,
      ...deletionFilter(),
    });
    if (liveWards > 0) {
      throw ApiError.conflict(
        `Cannot permanently delete this Sub-County while ${liveWards} ward(s) still reference it. Delete or permanently delete the wards first.`,
      );
    }
  },
  cascadePurge: async (doc) => {
    await Ward.deleteMany({ subCountyId: doc._id });
  },
  metadata: (doc) => ({ name: doc.name, code: doc.code }),
};

/** A soft-deleted record still occupies its unique code. */
async function assertSubCountyCodeAvailable(code: string): Promise<void> {
  const existing = await SubCounty.findOne({ code }).select("deletedAt");
  if (!existing) return;
  throw ApiError.conflict(
    existing.deletedAt
      ? "A sub-county with this code exists but is deleted — restore or permanently delete it first"
      : "A sub-county with this code already exists",
  );
}

export async function listSubCounties(query: {
  page: number;
  limit: number;
  search?: string;
  isActive?: string;
  deletionScope?: DeletionScope;
}) {
  const { page, limit, search, isActive, deletionScope } = query;

  const filter: Record<string, unknown> = { ...deletionFilter(deletionScope) };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }

  if (isActive) filter.isActive = isActive === "true";

  const [subCounties, total] = await Promise.all([
    SubCounty.find(filter)
      .populate("deletedBy", "name email")
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SubCounty.countDocuments(filter),
  ]);

  return {
    subCounties,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getSubCountyById(
  subCountyId: string,
  { includeDeleted = false }: { includeDeleted?: boolean } = {},
) {
  const subCounty = await SubCounty.findOne({
    _id: subCountyId,
    ...(includeDeleted ? {} : deletionFilter()),
  });
  if (!subCounty) {
    throw ApiError.notFound("Sub-County not found");
  }
  return subCounty;
}

export async function createSubCounty(input: { name: string; code: string }) {
  await assertSubCountyCodeAvailable(input.code);

  const subCounty = await SubCounty.create(input);

  await logSubCountyEvent(
    AuditAction.SUBCOUNTY_CREATED,
    subCounty._id.toString(),
    undefined,
    undefined,
    { name: subCounty.name, code: subCounty.code },
  );

  return subCounty;
}

export async function updateSubCounty(
  subCountyId: string,
  input: Record<string, unknown>,
) {
  const subCounty = await SubCounty.findById(subCountyId);
  if (!subCounty) {
    throw ApiError.notFound("Sub-County not found");
  }

  if (subCounty.deletedAt) {
    throw ApiError.badRequest(
      "Cannot edit a deleted Sub-County — restore it first",
    );
  }

  if (input.code && input.code !== subCounty.code) {
    await assertSubCountyCodeAvailable(input.code as string);
  }

  Object.assign(subCounty, input);
  await subCounty.save();

  await logSubCountyEvent(
    AuditAction.SUBCOUNTY_UPDATED,
    subCounty._id.toString(),
    undefined,
    undefined,
    { changes: Object.keys(input) },
  );

  return subCounty;
}

export async function deactivateSubCounty(subCountyId: string) {
  const subCounty = await SubCounty.findById(subCountyId);
  if (!subCounty) {
    throw ApiError.notFound("Sub-County not found");
  }

  subCounty.isActive = false;
  await subCounty.save();

  await logSubCountyEvent(
    AuditAction.SUBCOUNTY_DEACTIVATED,
    subCounty._id.toString(),
    undefined,
    undefined,
  );

  return subCounty;
}

export async function softDeleteSubCounty(
  subCountyId: string,
  actor: DeletionActor,
  reason?: string,
) {
  return softDeleteRecord(
    subCountyTarget,
    subCountyActions,
    subCountyId,
    actor,
    subCountyHooks,
    reason,
  );
}

export async function restoreSubCounty(
  subCountyId: string,
  actor: DeletionActor,
) {
  return restoreRecord(
    subCountyTarget,
    subCountyActions,
    subCountyId,
    actor,
    subCountyHooks,
  );
}

export async function purgeSubCounty(
  subCountyId: string,
  actor: DeletionActor,
) {
  return purgeRecord(
    subCountyTarget,
    subCountyActions,
    subCountyId,
    actor,
    subCountyHooks,
  );
}

// ═══ Wards ══════════════════════════════════════════════════════════════════

const wardTarget: DeletionTarget<IWard> = {
  label: "Ward",
  entityType: "Ward",
  model: Ward,
};

const wardActions = {
  softDelete: AuditAction.WARD_SOFT_DELETED,
  restore: AuditAction.WARD_RESTORED,
  purge: AuditAction.WARD_PURGED,
};

const wardHooks: DeletionHooks<IWard> = {
  beforeSoftDelete: (doc) => {
    doc.isActive = false;
  },
  beforeRestore: (doc) => {
    doc.isActive = true;
  },
  // Grievances denormalise the ward name onto the record, so historical
  // complaints stay readable after the ward itself is gone. Nothing cascades.
  metadata: (doc) => ({ name: doc.name, code: doc.code }),
};

/** A soft-deleted record still occupies its unique `{subCounty, code}` pair. */
async function assertWardCodeAvailable(
  subCountyId: string,
  code: string,
): Promise<void> {
  const existing = await Ward.findOne({ subCountyId, code }).select(
    "deletedAt",
  );
  if (!existing) return;
  throw ApiError.conflict(
    existing.deletedAt
      ? "A ward with this code exists in this sub-county but is deleted — restore or permanently delete it first"
      : "A ward with this code already exists in this sub-county",
  );
}

export async function listWards(query: {
  page: number;
  limit: number;
  search?: string;
  subCountyId?: string;
  isActive?: string;
  deletionScope?: DeletionScope;
}) {
  const { page, limit, search, subCountyId, isActive, deletionScope } = query;

  const filter: Record<string, unknown> = { ...deletionFilter(deletionScope) };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }

  if (subCountyId) filter.subCountyId = subCountyId;
  if (isActive) filter.isActive = isActive === "true";

  const [wards, total] = await Promise.all([
    Ward.find(filter)
      .populate("subCountyId", "name code")
      .populate("deletedBy", "name email")
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Ward.countDocuments(filter),
  ]);

  return {
    wards,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getWardById(
  wardId: string,
  { includeDeleted = false }: { includeDeleted?: boolean } = {},
) {
  const ward = await Ward.findOne({
    _id: wardId,
    ...(includeDeleted ? {} : deletionFilter()),
  }).populate("subCountyId", "name code");
  if (!ward) {
    throw ApiError.notFound("Ward not found");
  }
  return ward;
}

export async function createWard(input: {
  name: string;
  code: string;
  subCountyId: string;
}) {
  const subCounty = await SubCounty.findOne({
    _id: input.subCountyId,
    ...deletionFilter(),
  });
  if (!subCounty) {
    throw ApiError.badRequest("Sub-County not found");
  }

  await assertWardCodeAvailable(input.subCountyId, input.code);

  const ward = await Ward.create(input);

  await logWardEvent(
    AuditAction.WARD_CREATED,
    ward._id.toString(),
    undefined,
    undefined,
    { name: ward.name, code: ward.code, subCountyId: input.subCountyId },
  );

  return ward;
}

export async function updateWard(
  wardId: string,
  input: Record<string, unknown>,
) {
  const ward = await Ward.findById(wardId);
  if (!ward) {
    throw ApiError.notFound("Ward not found");
  }

  if (ward.deletedAt) {
    throw ApiError.badRequest("Cannot edit a deleted ward — restore it first");
  }

  if (input.subCountyId && input.subCountyId !== ward.subCountyId.toString()) {
    const subCounty = await SubCounty.findOne({
      _id: input.subCountyId,
      ...deletionFilter(),
    });
    if (!subCounty) {
      throw ApiError.badRequest("Sub-County not found");
    }
  }

  const targetSubCountyId =
    (input.subCountyId as string | undefined) ?? ward.subCountyId.toString();
  if (input.code && input.code !== ward.code) {
    await assertWardCodeAvailable(targetSubCountyId, input.code as string);
  }

  Object.assign(ward, input);
  await ward.save();

  await logWardEvent(
    AuditAction.WARD_UPDATED,
    ward._id.toString(),
    undefined,
    undefined,
    { changes: Object.keys(input) },
  );

  return ward;
}

export async function deactivateWard(wardId: string) {
  const ward = await Ward.findById(wardId);
  if (!ward) {
    throw ApiError.notFound("Ward not found");
  }

  ward.isActive = false;
  await ward.save();

  await logWardEvent(
    AuditAction.WARD_DEACTIVATED,
    ward._id.toString(),
    undefined,
    undefined,
  );

  return ward;
}

export async function softDeleteWard(
  wardId: string,
  actor: DeletionActor,
  reason?: string,
) {
  return softDeleteRecord(
    wardTarget,
    wardActions,
    wardId,
    actor,
    wardHooks,
    reason,
  );
}

export async function restoreWard(wardId: string, actor: DeletionActor) {
  return restoreRecord(wardTarget, wardActions, wardId, actor, wardHooks);
}

export async function purgeWard(wardId: string, actor: DeletionActor) {
  return purgeRecord(wardTarget, wardActions, wardId, actor, wardHooks);
}
