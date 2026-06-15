import { Queue, Worker, Job } from 'bullmq';
import redis from './redis';

const connection = redis;

// Define your queues here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const optimizationQueue = new Queue('optimization-data', { connection: connection as any });

// Example worker setup
export const optimizationWorker = new Worker(
  'optimization-data',
  async (job: Job) => {
    console.log(`Processing job ${job.id} of type ${job.name}`);
    console.log('Job data:', job.data);
    
    // Add your optimization/data-loading logic here
    // Example: await processDataLoad(job.data);
    
    return { success: true, message: 'Data processed successfully' };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { connection: connection as any }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
optimizationWorker.on('completed', (job: Job, returnvalue: any) => {
  console.log(`Job ${job.id} completed!`, returnvalue);
});

optimizationWorker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    console.error(`Job ${job.id} failed with error ${err.message}`);
  } else {
    console.error(`Job failed with error ${err.message}`);
  }
});

// --- Storage Retention Cleanup Queue & Worker ---
import prisma from './prisma';
import { storage } from './storage';

export const cleanupQueue = new Queue('cleanup-tasks', { connection: connection as any });

// Schedule the repeatable daily cleanup job at midnight
cleanupQueue.add(
  'daily-cleanup',
  {},
  {
    repeat: {
      pattern: '0 0 * * *', // Runs daily at midnight
    },
    jobId: 'daily-cleanup-job', // Stable ID prevents duplicate scheduling
  }
).catch((err) => {
  console.error('[Cleanup Queue] Failed to schedule daily cleanup job:', err);
});

export const cleanupWorker = new Worker(
  'cleanup-tasks',
  async (job: Job) => {
    console.log(`[Cleanup Job] Starting background storage cleanup...`);
    
    // 1. Fetch the active retention policy
    const policy = await prisma.retentionPolicy.findUnique({
      where: { id: 1 },
    });
    
    if (!policy || !policy.isEnabled) {
      console.log(`[Cleanup Job] Retention policy is disabled or not found. Skipping.`);
      return { success: true, message: 'Retention policy is disabled' };
    }
    
    // 2. Calculate threshold date
    const thresholdDate = new Date(Date.now() - policy.keepDays * 24 * 60 * 60 * 1000);
    console.log(`[Cleanup Job] Deleting attachments created before ${thresholdDate.toISOString()} (keepDays: ${policy.keepDays})`);
    
    // 3. Find attachments older than threshold that belong to completed tasks (status 'DONE')
    const expiredAttachments = await prisma.attachment.findMany({
      where: {
        created_at: {
          lt: thresholdDate,
        },
        task_id: {
          not: null,
        },
        task: {
          status: {
            name: 'DONE',
          },
        },
      },
    });
    
    console.log(`[Cleanup Job] Found ${expiredAttachments.length} expired attachments to delete.`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const attachment of expiredAttachments) {
      try {
        // Delete from cloud storage (Cloudinary, S3, etc.)
        await storage.deleteFile(attachment.file_url);
        
        // Delete from database
        await prisma.attachment.delete({
          where: { id: attachment.id },
        });
        
        deletedCount++;
      } catch (err: any) {
        console.error(`[Cleanup Job] Failed to delete attachment ID ${attachment.id}:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`[Cleanup Job] Completed! Deleted: ${deletedCount}, Errors: ${errorCount}`);
    return { success: true, deletedCount, errorCount };
  },
  { connection: connection as any }
);

cleanupWorker.on('completed', (job: Job, result: any) => {
  console.log(`[Cleanup Job] Job ${job.id} completed successfully!`, result);
});

cleanupWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Cleanup Job] Job ${job?.id} failed:`, err.message);
});
