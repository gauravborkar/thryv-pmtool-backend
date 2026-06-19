-- ===================================================================
-- RBAC Migration: Multi-Role + Permissions
-- ===================================================================
-- Step 1: Add optional description column to user_roles
ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Step 2: Create the permissions table
CREATE TABLE IF NOT EXISTS "permissions" (
    "id"          SERIAL PRIMARY KEY,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_name_key" UNIQUE ("name")
);

-- Step 3: Create the Role <-> Permission join table (many-to-many)
CREATE TABLE IF NOT EXISTS "_PermissionToUserRole" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "_PermissionToUserRole_AB_unique" ON "_PermissionToUserRole"("A", "B");
CREATE INDEX IF NOT EXISTS "_PermissionToUserRole_B_index" ON "_PermissionToUserRole"("B");

-- Step 4: Create the User <-> UserRole join table (many-to-many)
CREATE TABLE IF NOT EXISTS "_UserToUserRole" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "_UserToUserRole_AB_unique" ON "_UserToUserRole"("A", "B");
CREATE INDEX IF NOT EXISTS "_UserToUserRole_B_index" ON "_UserToUserRole"("B");

-- Step 5: Migrate existing user role assignments (role_id -> join table)
-- This preserves ALL existing user roles — zero data loss
INSERT INTO "_UserToUserRole" ("A", "B")
SELECT u.id, u.role_id
FROM "users" u
WHERE u.role_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 6: Drop the old single role_id column from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "role_id";

-- Step 7: Seed default permissions
INSERT INTO "permissions" ("name", "description") VALUES
('task:create',        'Create new tasks'),
('task:edit',          'Edit task details'),
('task:delete',        'Delete tasks'),
('task:view_all',      'View all tasks in the system'),
('task:view_own',      'View only assigned tasks'),
('task:assign',        'Assign tasks to team members'),
('task:upload',        'Upload files/attachments to tasks'),
('task:comment',       'Comment on tasks'),
('task:status_update', 'Update task workflow status'),
('client:view',        'View client information'),
('client:manage',      'Create, edit and delete clients'),
('user:view',          'View user list'),
('user:manage',        'Create, edit and delete users'),
('user:invite',        'Send user invitations'),
('calendar:view',      'View calendar entries'),
('calendar:manage',    'Create, edit and delete calendar entries'),
('dashboard:view',     'Access the analytics dashboard'),
('audit:view',         'View audit logs'),
('settings:manage',    'Manage system settings')
ON CONFLICT ("name") DO NOTHING;

-- Step 8: Assign permissions to ADMIN role (all permissions)
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT p.id, r.id
FROM "permissions" p, "user_roles" r
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Step 9: Assign permissions to MANAGER role
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT p.id, r.id
FROM "permissions" p, "user_roles" r
WHERE r.name = 'MANAGER'
  AND p.name IN (
    'task:create', 'task:edit', 'task:delete', 'task:view_all',
    'task:assign', 'task:upload', 'task:comment', 'task:status_update',
    'client:view', 'client:manage',
    'calendar:view', 'calendar:manage',
    'dashboard:view'
  )
ON CONFLICT DO NOTHING;

-- Step 10: Assign permissions to DESIGNER role
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT p.id, r.id
FROM "permissions" p, "user_roles" r
WHERE r.name = 'DESIGNER'
  AND p.name IN (
    'task:view_own', 'task:upload', 'task:comment', 'task:status_update',
    'calendar:view'
  )
ON CONFLICT DO NOTHING;

-- Step 11: Insert new worker roles if they don't exist yet
INSERT INTO "user_roles" ("name", "description") VALUES
('VIDEOGRAPHER', 'Video production team member'),
('EDITOR',       'Video/content editor team member')
ON CONFLICT ("name") DO NOTHING;

-- Step 12: Assign permissions to VIDEOGRAPHER role (same as DESIGNER)
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT p.id, r.id
FROM "permissions" p, "user_roles" r
WHERE r.name = 'VIDEOGRAPHER'
  AND p.name IN (
    'task:view_own', 'task:upload', 'task:comment', 'task:status_update',
    'calendar:view'
  )
ON CONFLICT DO NOTHING;

-- Step 13: Assign permissions to EDITOR role (same as DESIGNER)
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT p.id, r.id
FROM "permissions" p, "user_roles" r
WHERE r.name = 'EDITOR'
  AND p.name IN (
    'task:view_own', 'task:upload', 'task:comment', 'task:status_update',
    'calendar:view'
  )
ON CONFLICT DO NOTHING;
