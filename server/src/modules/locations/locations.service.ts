import { SubCounty } from '../../models/sub-county.model';
import { Ward } from '../../models/ward.model';
import { ApiError } from '../../utils/api-error';
import { logSubCountyEvent, logWardEvent } from '../../services/audit-impl';
import { AuditAction } from '../../services/audit.service';
import type {
  ListSubCountiesQuery,
  CreateSubCountyInput,
  UpdateSubCountyInput,
  ListWardsQuery,
  CreateWardInput,
  UpdateWardInput,
} from './locations.validation';

// ═══ Sub-Counties ═══════════════════════════════════════════════════════════

export async function listSubCounties(query: ListSubCountiesQuery) {
  const { page, limit, search, isActive } = query;

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }

  if (isActive) {
    filter.isActive = isActive === 'true';
  }

  const [subCounties, total] = await Promise.all([
    SubCounty.find(filter)
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

export async function getSubCountyById(subCountyId: string) {
  const subCounty = await SubCounty.findById(subCountyId);
  if (!subCounty) {
    throw ApiError.notFound('Sub-County not found');
  }
  return subCounty;
}

export async function createSubCounty(input: CreateSubCountyInput) {
  const existing = await SubCounty.findOne({ code: input.code });
  if (existing) {
    throw ApiError.conflict('A sub-county with this code already exists');
  }

  const subCounty = await SubCounty.create(input);

  await logSubCountyEvent(AuditAction.SUBCOUNTY_CREATED, subCounty._id.toString(), undefined, undefined, {
    name: subCounty.name,
    code: subCounty.code,
  });

  return subCounty;
}

export async function updateSubCounty(subCountyId: string, input: UpdateSubCountyInput) {
  const subCounty = await SubCounty.findById(subCountyId);
  if (!subCounty) {
    throw ApiError.notFound('Sub-County not found');
  }

  if (input.code && input.code !== subCounty.code) {
    const existing = await SubCounty.findOne({ code: input.code });
    if (existing) {
      throw ApiError.conflict('A sub-county with this code already exists');
    }
  }

  Object.assign(subCounty, input);
  await subCounty.save();

  await logSubCountyEvent(AuditAction.SUBCOUNTY_UPDATED, subCounty._id.toString(), undefined, undefined, {
    changes: Object.keys(input),
  });

  return subCounty;
}

export async function deactivateSubCounty(subCountyId: string) {
  const subCounty = await SubCounty.findById(subCountyId);
  if (!subCounty) {
    throw ApiError.notFound('Sub-County not found');
  }

  subCounty.isActive = false;
  await subCounty.save();

  return subCounty;
}

// ═══ Wards ══════════════════════════════════════════════════════════════════

export async function listWards(query: ListWardsQuery) {
  const { page, limit, search, subCountyId, isActive } = query;

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }

  if (subCountyId) {
    filter.subCountyId = subCountyId;
  }

  if (isActive) {
    filter.isActive = isActive === 'true';
  }

  const [wards, total] = await Promise.all([
    Ward.find(filter)
      .populate('subCountyId', 'name code')
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

export async function getWardById(wardId: string) {
  const ward = await Ward.findById(wardId).populate('subCountyId', 'name code');
  if (!ward) {
    throw ApiError.notFound('Ward not found');
  }
  return ward;
}

export async function createWard(input: CreateWardInput) {
  // Verify sub-county exists
  const subCounty = await SubCounty.findById(input.subCountyId);
  if (!subCounty) {
    throw ApiError.badRequest('Sub-County not found');
  }

  // Check for duplicate code within sub-county
  const existing = await Ward.findOne({
    subCountyId: input.subCountyId,
    code: input.code,
  });
  if (existing) {
    throw ApiError.conflict('A ward with this code already exists in this sub-county');
  }

  const ward = await Ward.create(input);

  await logWardEvent(AuditAction.WARD_CREATED, ward._id.toString(), undefined, undefined, {
    name: ward.name,
    code: ward.code,
    subCountyId: input.subCountyId,
  });

  return ward;
}

export async function updateWard(wardId: string, input: UpdateWardInput) {
  const ward = await Ward.findById(wardId);
  if (!ward) {
    throw ApiError.notFound('Ward not found');
  }

  // If moving to a different sub-county, verify it exists
  if (input.subCountyId && input.subCountyId !== ward.subCountyId.toString()) {
    const subCounty = await SubCounty.findById(input.subCountyId);
    if (!subCounty) {
      throw ApiError.badRequest('Sub-County not found');
    }
  }

  // Check for duplicate code within the (possibly new) sub-county
  const targetSubCountyId = input.subCountyId ?? ward.subCountyId.toString();
  if (input.code && input.code !== ward.code) {
    const existing = await Ward.findOne({
      subCountyId: targetSubCountyId,
      code: input.code,
    });
    if (existing) {
      throw ApiError.conflict('A ward with this code already exists in this sub-county');
    }
  }

  Object.assign(ward, input);
  await ward.save();

  await logWardEvent(AuditAction.WARD_UPDATED, ward._id.toString(), undefined, undefined, {
    changes: Object.keys(input),
  });

  return ward;
}

export async function deactivateWard(wardId: string) {
  const ward = await Ward.findById(wardId);
  if (!ward) {
    throw ApiError.notFound('Ward not found');
  }

  ward.isActive = false;
  await ward.save();

  return ward;
}
