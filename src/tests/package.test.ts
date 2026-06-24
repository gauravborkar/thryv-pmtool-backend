import request from 'supertest';
import app from '../app';
import { prismaMock } from './setup';

let mockCurrentUser: { id: number; email: string; roleIds: number[]; roles: string[] } | null = null;

// Mock auth middleware dynamically
jest.mock('../middleware/auth.middleware', () => {
  return {
    authenticate: (req: any, res: any, next: any) => {
      if (mockCurrentUser) {
        req.user = mockCurrentUser;
      }
      next();
    },
    authorize: (roleIds: number[]) => (req: any, res: any, next: any) => {
      if (!req.user || !req.user.roleIds.some((id: number) => roleIds.includes(id))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      next();
    },
    authorizeSection: () => (req: any, res: any, next: any) => next(),
  };
});

describe('Package Access Restriction Tests', () => {
  const restrictedId = 'pkg-1';
  const normalId = 'pkg-4';

  const mockFirstThree = [
    { id: 'pkg-1', created_at: new Date('2026-06-01') },
    { id: 'pkg-2', created_at: new Date('2026-06-02') },
    { id: 'pkg-3', created_at: new Date('2026-06-03') },
  ];

  beforeEach(() => {
    // Reset mock user and prisma mock
    mockCurrentUser = null;
    prismaMock.contentType.findMany.mockResolvedValue([{ id: 1, name: 'REEL' }] as any);
    prismaMock.socialPlatform.findMany.mockResolvedValue([{ id: 1, name: 'Instagram' }] as any);
    prismaMock.billingCycle.findMany.mockResolvedValue([{ id: 1, name: 'WEEKLY' }] as any);
  });

  describe('Update Package', () => {
    it('should allow ADMIN to update a restricted package', async () => {
      mockCurrentUser = { id: 1, email: 'admin@thryv.com', roleIds: [1], roles: ['ADMIN'] };

      // Mock package lookup
      prismaMock.contentPackage.findUnique.mockResolvedValue({
        id: restrictedId,
        name: 'standard gold',
        current_version: 1,
        line_items: [],
      } as any);

      // Mock top 3 packages query
      prismaMock.contentPackage.findMany.mockResolvedValue(mockFirstThree as any);

      // Mock update transaction
      prismaMock.$transaction.mockResolvedValue({
        id: restrictedId,
        name: 'Updated Name',
        client_id: null,
        description: null,
        current_version: 2,
        line_items: [],
        created_at: new Date(),
        updated_at: new Date(),
        created_by: { id: 1, email: 'admin@thryv.com', name: 'Admin' }
      } as any);

      const res = await request(app)
        .put(`/packages/${restrictedId}`)
        .send({ name: 'Updated Name', items: [{ type: 'REEL', platform: 'Instagram', cycle: 'WEEKLY', quantity: 1 }] });

      if (res.status !== 200) console.log("ADMIN UPDATE ERROR:", res.body);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });

    it('should NOT allow MANAGER to update a restricted package', async () => {
      mockCurrentUser = { id: 2, email: 'manager@thryv.com', roleIds: [2], roles: ['MANAGER'] };

      // Mock package lookup
      prismaMock.contentPackage.findUnique.mockResolvedValue({
        id: restrictedId,
        name: 'standard gold',
        current_version: 1,
        line_items: [],
      } as any);

      // Mock top 3 packages query
      prismaMock.contentPackage.findMany.mockResolvedValue(mockFirstThree as any);

      const res = await request(app)
        .put(`/packages/${restrictedId}`)
        .send({ name: 'Try to Update', items: [{ type: 'REEL', platform: 'Instagram', cycle: 'WEEKLY', quantity: 1 }] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Only administrators are authorized');
    });

    it('should allow MANAGER to update a non-restricted package', async () => {
      mockCurrentUser = { id: 2, email: 'manager@thryv.com', roleIds: [2], roles: ['MANAGER'] };

      // Mock package lookup
      prismaMock.contentPackage.findUnique.mockResolvedValue({
        id: normalId,
        name: 'Normal Package',
        current_version: 1,
        line_items: [],
      } as any);

      // Mock top 3 packages query
      prismaMock.contentPackage.findMany.mockResolvedValue(mockFirstThree as any);

      // Mock update transaction
      prismaMock.$transaction.mockResolvedValue({
        id: normalId,
        name: 'Updated Normal',
        client_id: null,
        description: null,
        current_version: 2,
        line_items: [],
        created_at: new Date(),
        updated_at: new Date(),
        created_by: { id: 1, email: 'admin@thryv.com', name: 'Admin' }
      } as any);

      const res = await request(app)
        .put(`/packages/${normalId}`)
        .send({ name: 'Updated Normal', items: [{ type: 'REEL', platform: 'Instagram', cycle: 'WEEKLY', quantity: 1 }] });

      if (res.status !== 200) console.log("MANAGER UPDATE ERROR:", res.body);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Normal');
    });
  });

  describe('Delete Package', () => {
    it('should allow ADMIN to delete a restricted package', async () => {
      mockCurrentUser = { id: 1, email: 'admin@thryv.com', roleIds: [1], roles: ['ADMIN'] };

      // Mock top 3 packages query
      prismaMock.contentPackage.findMany.mockResolvedValue(mockFirstThree as any);

      // Mock findUnique and delete
      prismaMock.contentPackage.findUnique.mockResolvedValue({ id: restrictedId } as any);
      prismaMock.contentPackage.delete.mockResolvedValue({ id: restrictedId } as any);

      const res = await request(app).delete(`/packages/${restrictedId}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Package deleted successfully');
    });

    it('should NOT allow MANAGER to delete a restricted package', async () => {
      mockCurrentUser = { id: 2, email: 'manager@thryv.com', roleIds: [2], roles: ['MANAGER'] };

      // Mock top 3 packages query
      prismaMock.contentPackage.findMany.mockResolvedValue(mockFirstThree as any);

      // Mock findUnique
      prismaMock.contentPackage.findUnique.mockResolvedValue({ id: restrictedId } as any);

      const res = await request(app).delete(`/packages/${restrictedId}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Only administrators are authorized');
    });

    it('should allow MANAGER to delete a non-restricted package', async () => {
      mockCurrentUser = { id: 2, email: 'manager@thryv.com', roleIds: [2], roles: ['MANAGER'] };

      // Mock top 3 packages query
      prismaMock.contentPackage.findMany.mockResolvedValue(mockFirstThree as any);

      // Mock findUnique and delete
      prismaMock.contentPackage.findUnique.mockResolvedValue({ id: normalId } as any);
      prismaMock.contentPackage.delete.mockResolvedValue({ id: normalId } as any);

      const res = await request(app).delete(`/packages/${normalId}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Package deleted successfully');
    });
  });
});
