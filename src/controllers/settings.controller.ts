import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

/**
 * @desc Get the active storage retention policy
 * @route GET /settings/retention
 * @access Private (Admin, Manager)
 */
export const getRetentionPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let policy = await prisma.retentionPolicy.findUnique({
      where: { id: 1 },
    });

    // Fallback in case seeding was skipped or row deleted
    if (!policy) {
      policy = await prisma.retentionPolicy.create({
        data: {
          id: 1,
          isEnabled: false,
          keepDays: 30,
        },
      });
    }

    res.status(200).json({
      message: 'Retention policy retrieved successfully',
      data: {
        isEnabled: policy.isEnabled,
        keepDays: policy.keepDays,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * @desc Update the storage retention policy
 * @route PUT /settings/retention
 * @access Private (Admin only)
 */
export const updateRetentionPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isEnabled, keepDays } = req.body;

    if (isEnabled === undefined || keepDays === undefined) {
      return res.status(400).json({ message: 'isEnabled and keepDays are required fields' });
    }

    const keepDaysNum = parseInt(keepDays, 10);
    if (Number.isNaN(keepDaysNum) || keepDaysNum <= 0) {
      return res.status(400).json({ message: 'keepDays must be a positive integer' });
    }

    const updatedPolicy = await prisma.retentionPolicy.upsert({
      where: { id: 1 },
      update: {
        isEnabled: Boolean(isEnabled),
        keepDays: keepDaysNum,
      },
      create: {
        id: 1,
        isEnabled: Boolean(isEnabled),
        keepDays: keepDaysNum,
      },
    });

    res.status(200).json({
      message: 'Retention policy updated successfully',
      data: {
        isEnabled: updatedPolicy.isEnabled,
        keepDays: updatedPolicy.keepDays,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

const SECTIONS = [
  'Dashboard',
  'Tasks',
  'Clients',
  'Calendar',
  'AI Calendar',
  'Packages',
  'Team Members',
  'Section Access'
];

const DEFAULT_ACCESS: Record<string, string[]> = {
  'Dashboard': ['ADMIN', 'MANAGER', 'DESIGNER', 'CLIENT'],
  'Tasks': ['ADMIN', 'MANAGER', 'DESIGNER', 'CLIENT'],
  'Clients': ['ADMIN'],
  'Calendar': ['ADMIN', 'MANAGER', 'DESIGNER', 'CLIENT'],
  'AI Calendar': ['ADMIN', 'MANAGER', 'DESIGNER', 'CLIENT'],
  'Packages': ['ADMIN', 'MANAGER'],
  'Team Members': ['ADMIN'],
  'Section Access': ['ADMIN']
};

const ensureAccessControlRulesTableExists = async () => {
  try {
    const res = await prisma.$queryRaw<any[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'access_control_rules'
    `;
    if (res.length === 0) {
      console.log('Creating table access_control_rules dynamically...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "access_control_rules" (
          "id" SERIAL NOT NULL,
          "section" TEXT NOT NULL,
          "roles" JSONB NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "access_control_rules_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "access_control_rules_section_key" ON "access_control_rules"("section");
      `);
      console.log('Table access_control_rules created successfully.');
    }
  } catch (err) {
    console.error('Failed to ensure access_control_rules table exists:', err);
  }
};

/**
 * @desc Get sidebar role access rules
 * @route GET /settings/sidebar-access
 * @access Private (Authenticated users)
 */
export const getSidebarAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureAccessControlRulesTableExists();

    let dbAccess: any[] = [];
    let dbRoles: any[] = [];

    try {
      [dbAccess, dbRoles] = await Promise.all([
        prisma.accessControlRule.findMany(),
        prisma.userRole.findMany({ select: { id: true, name: true } })
      ]);
    } catch (dbError) {
      console.warn('Prisma accessControlRule table query failed. Falling back to default rules/roles.', dbError);
      try {
        dbRoles = await prisma.userRole.findMany({ select: { id: true, name: true } });
      } catch (roleError) {
        dbRoles = [
          { id: 1, name: 'ADMIN' },
          { id: 2, name: 'MANAGER' },
          { id: 3, name: 'DESIGNER' },
          { id: 4, name: 'CLIENT' }
        ];
      }
    }

    // Map role names to IDs
    const roleNameToId: Record<string, number> = {};
    dbRoles.forEach(r => {
      roleNameToId[r.name] = r.id;
    });

    const rules = SECTIONS.map(sec => {
      const dbEntry = dbAccess.find(entry => entry.section === sec);
      
      let rolesList: (string | number)[] = [];
      if (dbEntry) {
        rolesList = dbEntry.roles as (string | number)[];
      } else {
        const defaultNames = DEFAULT_ACCESS[sec] || [];
        rolesList = defaultNames.map(name => roleNameToId[name]).filter(id => id !== undefined);
      }

      // Convert any legacy role names stored in db to role IDs dynamically
      const rolesWithIds = rolesList.map(role => {
        if (typeof role === 'number') return role;
        return roleNameToId[role];
      }).filter(id => id !== undefined && id !== 1);

      return {
        section: sec,
        roles: rolesWithIds
      };
    });

    res.status(200).json({
      message: 'Sidebar access rules retrieved successfully',
      data: {
        availableRoles: dbRoles.filter(r => r.id !== 1 && r.name !== 'ADMIN'),
        rules
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * @desc Update sidebar role access rules
 * @route PUT /settings/sidebar-access
 * @access Private (Admin only)
 */
export const updateSidebarAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({ message: 'rules must be an array of { section, roles }' });
    }

    await ensureAccessControlRulesTableExists();

    for (const rule of rules) {
      const { section, roles } = rule;
      if (!SECTIONS.includes(section)) {
        return res.status(400).json({ message: `Invalid section name: ${section}` });
      }
      if (!Array.isArray(roles)) {
        return res.status(400).json({ message: `roles for ${section} must be an array of numbers` });
      }

      // Validate that they are all numbers (role IDs) excluding ADMIN (1)
      const validRoleIds = roles.map(id => Number(id)).filter(id => !isNaN(id) && id !== 1);

      try {
        await prisma.accessControlRule.upsert({
          where: { section },
          update: {
            roles: validRoleIds
          },
          create: {
            section,
            roles: validRoleIds
          }
        });
      } catch (dbError: any) {
        console.error(`Failed to upsert access control rule for ${section}`, dbError);
        return res.status(500).json({
          message: `Database synchronization error: could not write to the access control rules table. Error: ${dbError.message}`
        });
      }
    }

    res.status(200).json({
      message: 'Sidebar access rules updated successfully'
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * @desc Get all roles
 * @route GET /settings/roles
 * @access Private (Admin only)
 */
export const getRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.userRole.findMany({
      select: { id: true, name: true, description: true, created_at: true },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ data: roles });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * @desc Create a new role
 * @route POST /settings/roles
 * @access Private (Admin only)
 */
export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    const normalized = name.toUpperCase().trim().replace(/\s+/g, '_');

    const existing = await prisma.userRole.findUnique({ where: { name: normalized } });
    if (existing) {
      return res.status(409).json({ message: `Role "${normalized}" already exists` });
    }

    const role = await prisma.userRole.create({
      data: { name: normalized, description: description?.trim() || null }
    });

    res.status(201).json({ data: role, message: `Role "${normalized}" created successfully` });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * @desc Delete a role by ID
 * @route DELETE /settings/roles/:id
 * @access Private (Admin only)
 */
export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid role ID' });
    }

    const role = await prisma.userRole.findUnique({ where: { id } });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Completely disable deleting any existing role
    return res.status(403).json({ message: `Role "${role.name}" cannot be deleted. Role deletion is disabled.` });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * @desc Get user's AI API key
 * @route GET /settings/ai-key
 * @access Private
 */
export const getAiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({
      message: 'AI API key feature has been deprecated',
      data: { 
        key: '',
        tokensUsed: 0,
        tokenLimit: 1000000
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * @desc Update user's AI API key
 * @route PUT /settings/ai-key
 * @access Private
 */
export const updateAiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({
      message: 'AI API key feature has been deprecated',
      data: { key: '' }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};
