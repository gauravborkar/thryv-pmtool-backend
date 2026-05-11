import { PrismaClient } from '@prisma/client'

// Single shared instance — prevents connection pool exhaustion
const prisma = new PrismaClient()

export default prisma
