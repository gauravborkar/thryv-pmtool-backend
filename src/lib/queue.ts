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
