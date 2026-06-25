import prisma from '../lib/prisma';

export type LineChangeKind = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
export type PackageChangeType = 'CREATED' | 'UPDATED';

export interface PackageLineItemInput {
  id?: string;
  type: string;
  platform: string;
  cycle: string;
  quantity: number;
  notes?: string;
  eligibleForPartialRegeneration?: boolean;
}

export interface CreateContentPackageInput {
  name: string;
  clientId?: number;
  description?: string;
  items: PackageLineItemInput[];
}

export interface UpdateContentPackageInput {
  name?: string;
  clientId?: number;
  description?: string;
  items?: PackageLineItemInput[];
}

export interface PackageChangeSummary {
  metadataChanged: boolean;
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  linesUnchanged: number;
  eligibleForRegeneration: number;
}

interface ResolvedLineItem {
  id?: string;
  content_type_id: number;
  platform_id: number;
  billing_cycle_id: number;
  quantity: number;
  notes: string | null;
  type: string;
  platform: string;
  cycle: string;
  eligible_for_partial_regeneration: boolean;
}

interface NormalizedLineItem {
  id?: string;
  type: string;
  platform: string;
  cycle: string;
  quantity: number;
  notes: string;
}

const packageInclude = {
  client: {
    select: {
      name: true,
    },
  },
  created_by: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  line_items: {
    include: {
      content_type: true,
      platform: true,
      billing_cycle: true,
    },
    orderBy: {
      created_at: 'asc' as const,
    },
  },
};

const versionInclude = {
  edited_by: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  line_items: {
    include: {
      content_type: true,
      platform: true,
      billing_cycle: true,
    },
    orderBy: {
      id: 'asc' as const,
    },
  },
};

type PackageWithRelations = NonNullable<
  Awaited<ReturnType<typeof prisma.contentPackage.findFirst>>
> & {
  client?: { name: string } | null;
  created_by: { id: number; email: string; name: string };
  line_items: Array<{
    id: string;
    quantity: number;
    notes: string | null;
    eligible_for_partial_regeneration: boolean;
    content_type: { name: string };
    platform: { name: string };
    billing_cycle: { name: string };
  }>;
};

function normalizeNotes(notes?: string | null) {
  return (notes ?? '').trim();
}

function normalizeLineItem(item: {
  id?: string;
  type: string;
  platform: string;
  cycle: string;
  quantity: number;
  notes?: string | null;
}): NormalizedLineItem {
  return {
    id: item.id,
    type: item.type,
    platform: item.platform,
    cycle: item.cycle,
    quantity: item.quantity,
    notes: normalizeNotes(item.notes),
  };
}

function lineContentKey(item: {
  type: string;
  platform: string;
  cycle: string;
  quantity: number;
  notes?: string | null;
}) {
  return `${item.type}|${item.platform}|${item.cycle}|${item.quantity}|${normalizeNotes(item.notes)}`;
}

function lineSlotKey(item: Pick<NormalizedLineItem, 'type' | 'platform' | 'cycle'>) {
  return `${item.type}|${item.platform}|${item.cycle}`;
}

function defaultEligibility(changeKind: LineChangeKind) {
  return changeKind === 'ADDED' || changeKind === 'MODIFIED';
}

export function computeLineDiff(
  previousItems: NormalizedLineItem[],
  nextItems: NormalizedLineItem[]
) {
  const previousById = new Map(previousItems.filter((i) => i.id).map((i) => [i.id!, i]));
  const nextById = new Map(nextItems.filter((i) => i.id).map((i) => [i.id!, i]));
  const matchedPreviousIds = new Set<string>();
  const matchedNextIds = new Set<string>();

  const results: Array<{
    item: NormalizedLineItem;
    changeKind: LineChangeKind;
  }> = [];

  for (const nextItem of nextItems) {
    if (nextItem.id && previousById.has(nextItem.id)) {
      const prev = previousById.get(nextItem.id)!;
      matchedPreviousIds.add(nextItem.id);
      matchedNextIds.add(nextItem.id);
      const changeKind =
        lineContentKey(prev) === lineContentKey(nextItem) ? 'UNCHANGED' : 'MODIFIED';
      results.push({ item: nextItem, changeKind });
      continue;
    }

    const slotMatches = previousItems.filter(
      (prev) =>
        !matchedPreviousIds.has(prev.id ?? '') &&
        lineSlotKey(prev) === lineSlotKey(nextItem)
    );

    if (slotMatches.length === 1) {
      const prev = slotMatches[0];
      if (prev.id) matchedPreviousIds.add(prev.id);
      const changeKind =
        lineContentKey(prev) === lineContentKey(nextItem) ? 'UNCHANGED' : 'MODIFIED';
      results.push({ item: { ...nextItem, id: nextItem.id ?? prev.id }, changeKind });
      continue;
    }

    results.push({ item: nextItem, changeKind: 'ADDED' });
  }

  for (const prevItem of previousItems) {
    if (prevItem.id && matchedPreviousIds.has(prevItem.id)) continue;
    const stillPresent = nextItems.some(
      (nextItem) =>
        (prevItem.id && nextItem.id === prevItem.id) ||
        lineContentKey(prevItem) === lineContentKey(nextItem)
    );
    if (!stillPresent) {
      results.push({ item: prevItem, changeKind: 'REMOVED' });
    }
  }

  return results;
}

function buildChangeSummary(
  metadataChanged: boolean,
  lineDiff: Array<{ changeKind: LineChangeKind; eligible: boolean }>
): PackageChangeSummary {
  const linesAdded = lineDiff.filter((l) => l.changeKind === 'ADDED').length;
  const linesRemoved = lineDiff.filter((l) => l.changeKind === 'REMOVED').length;
  const linesModified = lineDiff.filter((l) => l.changeKind === 'MODIFIED').length;
  const linesUnchanged = lineDiff.filter((l) => l.changeKind === 'UNCHANGED').length;

  return {
    metadataChanged,
    linesAdded,
    linesRemoved,
    linesModified,
    linesUnchanged,
    eligibleForRegeneration: lineDiff.filter((l) => l.eligible).length,
  };
}

export function formatContentPackage(pkg: PackageWithRelations) {
  return {
    id: pkg.id,
    client_id: pkg.client_id,
    client: pkg.client ? { name: pkg.client.name } : null,
    name: pkg.name,
    description: pkg.description ?? undefined,
    currentVersion: pkg.current_version,
    items: pkg.line_items.map((item) => ({
      id: item.id,
      type: item.content_type.name,
      platform: item.platform.name,
      cycle: item.billing_cycle.name,
      quantity: item.quantity,
      notes: item.notes ?? undefined,
      eligibleForPartialRegeneration: item.eligible_for_partial_regeneration,
    })),
    createdAt: pkg.created_at.toISOString(),
    updatedAt: pkg.updated_at.toISOString(),
    createdBy: pkg.created_by.email,
  };
}

function formatVersionLineItem(item: {
  id: string;
  source_line_item_id: string | null;
  quantity: number;
  notes: string | null;
  change_kind: string;
  eligible_for_partial_regeneration: boolean;
  content_type: { name: string };
  platform: { name: string };
  billing_cycle: { name: string };
}) {
  return {
    id: item.id,
    sourceLineItemId: item.source_line_item_id ?? undefined,
    type: item.content_type.name,
    platform: item.platform.name,
    cycle: item.billing_cycle.name,
    quantity: item.quantity,
    notes: item.notes ?? undefined,
    changeKind: item.change_kind as LineChangeKind,
    eligibleForPartialRegeneration: item.eligible_for_partial_regeneration,
  };
}

export function formatPackageVersionSummary(version: {
  id: string;
  version_number: number;
  name: string;
  description: string | null;
  change_type: string;
  change_summary: unknown;
  created_at: Date;
  edited_by: { email: string; name: string };
  line_items: Array<{ eligible_for_partial_regeneration: boolean }>;
}) {
  const summary = version.change_summary as PackageChangeSummary | null;
  return {
    id: version.id,
    versionNumber: version.version_number,
    name: version.name,
    description: version.description ?? undefined,
    changeType: version.change_type as PackageChangeType,
    changeSummary: summary ?? {
      metadataChanged: false,
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
      linesUnchanged: 0,
      eligibleForRegeneration: version.line_items.filter((i) => i.eligible_for_partial_regeneration)
        .length,
    },
    editedBy: version.edited_by.email,
    editedByName: version.edited_by.name,
    createdAt: version.created_at.toISOString(),
  };
}

export function formatPackageVersionDetail(
  version: Awaited<ReturnType<typeof prisma.contentPackageVersion.findFirst>> & {
    edited_by: { email: string; name: string };
    line_items: Array<Parameters<typeof formatVersionLineItem>[0]>;
  }
) {
  return {
    ...formatPackageVersionSummary(version),
    items: version.line_items.map(formatVersionLineItem),
  };
}

async function resolveLineItemLookups(items: PackageLineItemInput[]) {
  const [contentTypes, platforms, billingCycles] = await Promise.all([
    prisma.contentType.findMany(),
    prisma.socialPlatform.findMany(),
    prisma.billingCycle.findMany(),
  ]);

  const contentTypeMap = new Map(contentTypes.map((t) => [t.name, t.id]));
  const platformMap = new Map(platforms.map((p) => [p.name, p.id]));
  const cycleMap = new Map(billingCycles.map((c) => [c.name, c.id]));

  return items.map((item, index) => {
    const contentTypeId = contentTypeMap.get(item.type);
    const platformId = platformMap.get(item.platform);
    const cycleId = cycleMap.get(item.cycle);

    if (!contentTypeId) {
      throw new Error(`Invalid content type at line ${index + 1}: ${item.type}`);
    }
    if (!platformId) {
      throw new Error(`Invalid platform at line ${index + 1}: ${item.platform}`);
    }
    if (!cycleId) {
      throw new Error(`Invalid billing cycle at line ${index + 1}: ${item.cycle}`);
    }

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 999) {
      throw new Error(`Quantity must be between 0 and 999 at line ${index + 1}`);
    }

    return {
      id: item.id,
      content_type_id: contentTypeId,
      platform_id: platformId,
      billing_cycle_id: cycleId,
      quantity: Math.floor(quantity),
      notes: normalizeNotes(item.notes) || null,
      type: item.type,
      platform: item.platform,
      cycle: item.cycle,
      eligible_for_partial_regeneration: item.eligibleForPartialRegeneration ?? false,
    } satisfies ResolvedLineItem;
  });
}

function validatePackageInput(data: CreateContentPackageInput | UpdateContentPackageInput) {
  if ('name' in data && data.name !== undefined) {
    const name = data.name.trim();
    if (!name) {
      throw new Error('Package name is required');
    }
  }

  if ('items' in data && data.items !== undefined) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Add at least one content line (reel, carousel, static, or story)');
    }
  }
}

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createVersionSnapshot(
  params: {
    packageId: string;
    versionNumber: number;
    name: string;
    description: string | null;
    changeType: PackageChangeType;
    changeSummary: PackageChangeSummary;
    editedById: number;
    lineSnapshots: Array<{
      sourceLineItemId?: string;
      contentTypeId: number;
      platformId: number;
      billingCycleId: number;
      quantity: number;
      notes: string | null;
      changeKind: LineChangeKind;
      eligibleForPartialRegeneration: boolean;
    }>;
  },
  db: PrismaTransaction | typeof prisma = prisma
) {
  await db.contentPackageVersion.create({
    data: {
      package_id: params.packageId,
      version_number: params.versionNumber,
      name: params.name,
      description: params.description,
      change_type: params.changeType,
      change_summary: params.changeSummary as object,
      edited_by_id: params.editedById,
      line_items: {
        create: params.lineSnapshots.map((line) => ({
          source_line_item_id: line.sourceLineItemId,
          content_type_id: line.contentTypeId,
          platform_id: line.platformId,
          billing_cycle_id: line.billingCycleId,
          quantity: line.quantity,
          notes: line.notes,
          change_kind: line.changeKind,
          eligible_for_partial_regeneration: line.eligibleForPartialRegeneration,
        })),
      },
    },
  });
}

async function syncLineItems(
  packageId: string,
  resolvedItems: ResolvedLineItem[],
  lineDiff: Array<{ item: NormalizedLineItem; changeKind: LineChangeKind; eligible: boolean }>,
  db: PrismaTransaction | typeof prisma = prisma
) {
  const existingItems = await db.contentPackageLineItem.findMany({
    where: { package_id: packageId },
  });
  const existingIds = new Set(existingItems.map((item) => item.id));
  const incomingIds = new Set(
    resolvedItems.map((item) => item.id).filter((id): id is string => Boolean(id))
  );

  const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));
  if (idsToDelete.length > 0) {
    await db.contentPackageLineItem.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }

  const diffByContent = new Map(
    lineDiff
      .filter((entry) => entry.changeKind !== 'REMOVED')
      .map((entry) => [lineContentKey(entry.item), entry])
  );

  for (const item of resolvedItems) {
    const normalized = normalizeLineItem(item);
    const diffEntry = diffByContent.get(lineContentKey(normalized));
    const eligible =
      item.eligible_for_partial_regeneration ??
      diffEntry?.eligible ??
      defaultEligibility(diffEntry?.changeKind ?? 'ADDED');

    if (item.id && existingIds.has(item.id)) {
      await db.contentPackageLineItem.update({
        where: { id: item.id },
        data: {
          content_type_id: item.content_type_id,
          platform_id: item.platform_id,
          billing_cycle_id: item.billing_cycle_id,
          quantity: item.quantity,
          notes: item.notes,
          eligible_for_partial_regeneration: eligible,
        },
      });
      continue;
    }

    await db.contentPackageLineItem.create({
      data: {
        package_id: packageId,
        content_type_id: item.content_type_id,
        platform_id: item.platform_id,
        billing_cycle_id: item.billing_cycle_id,
        quantity: item.quantity,
        notes: item.notes,
        eligible_for_partial_regeneration: eligible,
      },
    });
  }
}

export const getContentPackages = async () => {
  const packages = await prisma.contentPackage.findMany({
    where: { is_deleted: false },
    include: packageInclude,
    orderBy: { created_at: 'desc' },
  });

  return packages.map(formatContentPackage);
};

export const getContentPackageById = async (id: string) => {
  const pkg = await prisma.contentPackage.findFirst({
    where: { id, is_deleted: false },
    include: packageInclude,
  });

  if (!pkg) {
    throw new Error('Package not found');
  }

  return formatContentPackage(pkg);
};

export const getPackageHistory = async (packageId: string) => {
  const pkg = await prisma.contentPackage.findFirst({
    where: { id: packageId, is_deleted: false }
  });
  if (!pkg) {
    throw new Error('Package not found');
  }

  const versions = await prisma.contentPackageVersion.findMany({
    where: { package_id: packageId },
    include: {
      edited_by: { select: { email: true, name: true } },
      line_items: { select: { eligible_for_partial_regeneration: true } },
    },
    orderBy: { version_number: 'desc' },
  });

  return versions.map(formatPackageVersionSummary);
};

export const getPackageVersion = async (packageId: string, versionNumber: number) => {
  const pkg = await prisma.contentPackage.findFirst({
    where: { id: packageId, is_deleted: false }
  });
  if (!pkg) {
    throw new Error('Package not found');
  }

  const version = await prisma.contentPackageVersion.findUnique({
    where: {
      package_id_version_number: {
        package_id: packageId,
        version_number: versionNumber,
      },
    },
    include: versionInclude,
  });

  if (!version) {
    throw new Error('Package version not found');
  }

  return formatPackageVersionDetail(version);
};

export const createContentPackage = async (
  data: CreateContentPackageInput,
  user: { id: number }
) => {
  validatePackageInput(data);

  const name = data.name.trim();
  const resolvedItems = await resolveLineItemLookups(data.items);
  const lineDiff = resolvedItems.map((item) => ({
    item: normalizeLineItem(item),
    changeKind: 'ADDED' as LineChangeKind,
    eligible: item.eligible_for_partial_regeneration ?? true,
  }));
  const changeSummary = buildChangeSummary(false, lineDiff);

  // First transaction: create the package and its line items
  const createdPkg = await prisma.contentPackage.create({
    data: {
      name,
      client_id: data.clientId,
      description: normalizeNotes(data.description) || null,
      created_by_id: user.id,
      current_version: 1,
      line_items: {
        create: resolvedItems.map((item) => ({
          content_type_id: item.content_type_id,
          platform_id: item.platform_id,
          billing_cycle_id: item.billing_cycle_id,
          quantity: item.quantity,
          notes: item.notes,
          eligible_for_partial_regeneration: true,
        })),
      },
    },
    include: packageInclude,
  });

const persistedItems = await prisma.contentPackageLineItem.findMany({
  where: { package_id: createdPkg.id },
  include: { content_type: true, platform: true, billing_cycle: true },
});

const created = { pkg: createdPkg, persistedItems };

  // Create version snapshot outside of the long transaction
  await createVersionSnapshot(
    {
      packageId: created.pkg.id,
      versionNumber: 1,
      name: created.pkg.name,
      description: created.pkg.description,
      changeType: 'CREATED',
      changeSummary,
      editedById: user.id,
      lineSnapshots: created.persistedItems.map((item) => ({
        sourceLineItemId: item.id,
        contentTypeId: item.content_type_id,
        platformId: item.platform_id,
        billingCycleId: item.billing_cycle_id,
        quantity: item.quantity,
        notes: item.notes,
        changeKind: 'ADDED',
        eligibleForPartialRegeneration: true,
      })),
    },
    prisma
  );

  return formatContentPackage(created.pkg);
};




async function checkPackageRestriction(id: string, user: { roleIds?: number[] }) {
  const firstThree = await prisma.contentPackage.findMany({
    where: { is_deleted: false },
    orderBy: { created_at: 'asc' },
    take: 3,
    select: { id: true },
  });
  const firstThreeIds = firstThree.map((p) => p.id);

  if (firstThreeIds.includes(id)) {
    const isAdmin = user.roleIds?.includes(1);
    if (!isAdmin) {
      throw new Error('Forbidden: Only administrators are authorized to update or delete the first three system packages');
    }
  }
}

export const updateContentPackage = async (
  id: string,
  data: UpdateContentPackageInput,
  user: { id: number; roleIds?: number[] }
) => {
  await checkPackageRestriction(id, user);

  const existing = await prisma.contentPackage.findFirst({
    where: { id, is_deleted: false },
    include: packageInclude,
  });

  if (!existing) {
    throw new Error('Package not found');
  }

  validatePackageInput(data);

  const nextName = data.name !== undefined ? data.name.trim() : existing.name;
  const nextDescription =
    data.description !== undefined
      ? normalizeNotes(data.description) || null
      : existing.description;

  const metadataChanged =
    nextName !== existing.name ||
    (nextDescription ?? '') !== (existing.description ?? '');

  if (!data.items) {
    if (!metadataChanged) {
      return formatContentPackage(existing);
    }

    const nextVersion = existing.current_version + 1;
    const changeSummary = buildChangeSummary(true, []);

    const pkg = await prisma.$transaction(async (tx) => {
      await tx.contentPackage.update({
        where: { id },
        data: {
          name: nextName,
          client_id: data.clientId !== undefined ? data.clientId : existing.client_id,
          description: nextDescription,
          current_version: nextVersion,
        },
      });

      const updated = await tx.contentPackage.findUnique({
        where: { id },
        include: packageInclude,
      });

      if (!updated) {
        throw new Error('Package not found after update');
      }

      await createVersionSnapshot(
        {
          packageId: id,
          versionNumber: nextVersion,
          name: updated.name,
          description: updated.description,
          changeType: 'UPDATED',
          changeSummary,
          editedById: user.id,
          lineSnapshots: updated.line_items.map((item) => ({
            sourceLineItemId: item.id,
            contentTypeId: item.content_type_id,
            platformId: item.platform_id,
            billingCycleId: item.billing_cycle_id,
            quantity: item.quantity,
            notes: item.notes,
            changeKind: 'UNCHANGED',
            eligibleForPartialRegeneration: item.eligible_for_partial_regeneration,
          })),
        },
        tx
      );

      return updated;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return formatContentPackage(pkg);
  }

  const resolvedItems = await resolveLineItemLookups(data.items);
  const previousItems = existing.line_items.map((item) =>
    normalizeLineItem({
      id: item.id,
      type: item.content_type.name,
      platform: item.platform.name,
      cycle: item.billing_cycle.name,
      quantity: item.quantity,
      notes: item.notes ?? '',
    })
  );
  const nextItems = resolvedItems.map((item) =>
    normalizeLineItem({
      id: item.id,
      type: item.type,
      platform: item.platform,
      cycle: item.cycle,
      quantity: item.quantity,
      notes: item.notes ?? '',
    })
  );

  const rawDiff = computeLineDiff(previousItems, nextItems);
  const lineDiff = rawDiff.map((entry) => {
    const resolved = resolvedItems.find(
      (item) =>
        item.id === entry.item.id ||
        lineContentKey(item) === lineContentKey(entry.item)
    );
    const eligible =
      resolved?.eligible_for_partial_regeneration ?? defaultEligibility(entry.changeKind);

    return {
      item: entry.item,
      changeKind: entry.changeKind,
      eligible,
    };
  });

  const changeSummary = buildChangeSummary(metadataChanged, lineDiff);
  const nextVersion = existing.current_version + 1;

  const pkg = await prisma.$transaction(async (tx) => {
    await tx.contentPackage.update({
      where: { id },
      data: {
        name: nextName,
        client_id: data.clientId !== undefined ? data.clientId : existing.client_id,
        description: nextDescription,
        current_version: nextVersion,
      },
    });

    await syncLineItems(id, resolvedItems, lineDiff, tx);

    const updated = await tx.contentPackage.findUnique({
      where: { id },
      include: packageInclude,
    });

    if (!updated) {
      throw new Error('Package not found after update');
    }

    const diffMap = new Map(
      lineDiff
        .filter((entry) => entry.changeKind !== 'REMOVED')
        .map((entry) => [lineContentKey(entry.item), entry])
    );

    await createVersionSnapshot(
      {
        packageId: id,
        versionNumber: nextVersion,
        name: updated.name,
        description: updated.description,
        changeType: 'UPDATED',
        changeSummary,
        editedById: user.id,
        lineSnapshots: updated.line_items.map((item) => {
          const normalized = normalizeLineItem({
            id: item.id,
            type: item.content_type.name,
            platform: item.platform.name,
            cycle: item.billing_cycle.name,
            quantity: item.quantity,
            notes: item.notes,
          });
          const diffEntry = diffMap.get(lineContentKey(normalized));

          return {
            sourceLineItemId: item.id,
            contentTypeId: item.content_type_id,
            platformId: item.platform_id,
            billingCycleId: item.billing_cycle_id,
            quantity: item.quantity,
            notes: item.notes,
            changeKind: diffEntry?.changeKind ?? 'UNCHANGED',
            eligibleForPartialRegeneration:
              item.eligible_for_partial_regeneration ??
              diffEntry?.eligible ??
              false,
          };
        }),
      },
      tx
    );

    return updated;
  }, {
    maxWait: 10000,
    timeout: 30000,
  });

  return formatContentPackage(pkg);
};

export const deleteContentPackage = async (id: string, user: { id: number; roleIds?: number[] }) => {
  await checkPackageRestriction(id, user);

  const existing = await prisma.contentPackage.findFirst({
    where: { id, is_deleted: false }
  });
  if (!existing) {
    throw new Error('Package not found');
  }

  await prisma.contentPackage.update({
    where: { id },
    data: { is_deleted: true },
  });
  return { id };
};

export const getPackageBuilderLookups = async () => {
  const [contentTypes, platforms, billingCycles] = await Promise.all([
    prisma.contentType.findMany({ orderBy: { name: 'asc' } }),
    prisma.socialPlatform.findMany({ orderBy: { name: 'asc' } }),
    prisma.billingCycle.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return {
    contentTypes: contentTypes.map((t) => t.name),
    platforms: platforms.map((p) => p.name),
    billingCycles: billingCycles.map((c) => c.name),
  };
};
