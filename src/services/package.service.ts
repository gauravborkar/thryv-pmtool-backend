import prisma from '../lib/prisma';

export interface PackageLineItemInput {
  id?: string;
  type: string;
  platform: string;
  cycle: string;
  quantity: number;
  notes?: string;
}

export interface CreateContentPackageInput {
  name: string;
  description?: string;
  items: PackageLineItemInput[];
}

export interface UpdateContentPackageInput {
  name?: string;
  description?: string;
  items?: PackageLineItemInput[];
}

const packageInclude = {
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

type PackageWithRelations = Awaited<
  ReturnType<typeof prisma.contentPackage.findFirst>
> & {
  created_by: { id: number; email: string; name: string };
  line_items: Array<{
    id: string;
    quantity: number;
    notes: string | null;
    content_type: { name: string };
    platform: { name: string };
    billing_cycle: { name: string };
  }>;
};

export function formatContentPackage(pkg: NonNullable<PackageWithRelations>) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description ?? undefined,
    items: pkg.line_items.map((item) => ({
      id: item.id,
      type: item.content_type.name,
      platform: item.platform.name,
      cycle: item.billing_cycle.name,
      quantity: item.quantity,
      notes: item.notes ?? undefined,
    })),
    createdAt: pkg.created_at.toISOString(),
    updatedAt: pkg.updated_at.toISOString(),
    createdBy: pkg.created_by.email,
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
      notes: item.notes?.trim() || null,
    };
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

export const getContentPackages = async () => {
  const packages = await prisma.contentPackage.findMany({
    include: packageInclude,
    orderBy: { created_at: 'desc' },
  });

  return packages.map(formatContentPackage);
};

export const getContentPackageById = async (id: string) => {
  const pkg = await prisma.contentPackage.findUnique({
    where: { id },
    include: packageInclude,
  });

  if (!pkg) {
    throw new Error('Package not found');
  }

  return formatContentPackage(pkg);
};

export const createContentPackage = async (
  data: CreateContentPackageInput,
  user: { id: number }
) => {
  validatePackageInput(data);

  const name = data.name.trim();
  const resolvedItems = await resolveLineItemLookups(data.items);

  const pkg = await prisma.contentPackage.create({
    data: {
      name,
      description: data.description?.trim() || null,
      created_by_id: user.id,
      line_items: {
        create: resolvedItems.map(({ id: _id, ...item }) => item),
      },
    },
    include: packageInclude,
  });

  return formatContentPackage(pkg);
};

export const updateContentPackage = async (id: string, data: UpdateContentPackageInput) => {
  const existing = await prisma.contentPackage.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Package not found');
  }

  validatePackageInput(data);

  const updateData: {
    name?: string;
    description?: string | null;
  } = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }
  if (data.description !== undefined) {
    updateData.description = data.description.trim() || null;
  }

  const resolvedItems = data.items ? await resolveLineItemLookups(data.items) : null;

  const pkg = await prisma.$transaction(async (tx) => {
    if (resolvedItems) {
      await tx.contentPackageLineItem.deleteMany({ where: { package_id: id } });
    }

    return tx.contentPackage.update({
      where: { id },
      data: {
        ...updateData,
        ...(resolvedItems
          ? {
              line_items: {
                create: resolvedItems.map(({ id: _id, ...item }) => item),
              },
            }
          : {}),
      },
      include: packageInclude,
    });
  });

  return formatContentPackage(pkg);
};

export const deleteContentPackage = async (id: string) => {
  const existing = await prisma.contentPackage.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Package not found');
  }

  await prisma.contentPackage.delete({ where: { id } });
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
