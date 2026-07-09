import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { getBlackoutDates, addBlackoutDate, removeBlackoutDate } from '../controllers/calendar.controller';
import { addDays, endOfMonth, parseISO, startOfMonth, format } from 'date-fns';
import { createNotification } from '../services/notification.service';
import { upload } from '../middleware/upload.middleware';
import { generateCalendarData, AIModelType, buildContext } from '../services/ai.service';
import * as xlsx from 'xlsx';
import { storage } from '../lib/storage';

const router = Router();

// --- Blackout Dates Routes ---
router.get('/blackouts', authenticate, getBlackoutDates);
router.post('/blackouts', authenticate, authorize([1, 2]), addBlackoutDate);
router.delete('/blackouts/:date', authenticate, authorize([1, 2]), removeBlackoutDate);

/**
 * @route POST /calendar/import
 * @desc Import AI Calendar Data
 * @access Private
 */
router.post('/import', authenticate, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { client_id } = req.body;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!client_id) {
      return res.status(400).json({ message: 'client_id is required' });
    }

    // Upload the file to cloud storage since multer keeps it in memory
    const { fileUrl } = await storage.uploadFile({
      fileName: file.originalname,
      fileType: file.mimetype,
      buffer: file.buffer,
      folder: 'calendar-imports',
    });

    // Save the raw file as an Attachment
    const attachment = await prisma.attachment.create({
      data: {
        file_name: file.originalname,
        file_url: fileUrl,
        file_type: file.mimetype,
        file_size: file.size,
        client_id: Number(client_id),
        uploaded_by: (req as any).user.id,
      },
    });

    // Parse the Excel file and store each sheet dynamically
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    // Delete existing knowledge for this client to replace with new upload
    await prisma.clientKnowledge.deleteMany({
      where: { client_id: Number(client_id) }
    });

    const knowledgePromises = sheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
      
      // Store the parsed sheet data in ClientKnowledge
      return prisma.clientKnowledge.create({
        data: {
          client_id: Number(client_id),
          sheet_name: sheetName,
          data: data as any,
        }
      });
    });

    await Promise.all(knowledgePromises);

    res.status(200).json({
      message: 'File uploaded successfully',
      data: attachment,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to upload file' });
  }
});

/**
 * @route POST /calendar/generate
 * @desc Generate calendar data using Groq/Gemini
 * @access Private
 */
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { client_id, month, model, instructions, preview } = req.body;
    const rawStrategy = req.body.strategy;
    const strategy = rawStrategy?.strategy ? rawStrategy.strategy : rawStrategy;

    if (!client_id || !month) {
      return res.status(400).json({ message: 'client_id and month are required' });
    }

    if (strategy && (strategy.briefGuidelines || strategy.aiProfileContext)) {
      const client = await prisma.client.findUnique({ where: { id: Number(client_id) } });
      const currentBrandDetails = (client?.brand_details as any) || {};
      
      if (strategy.briefGuidelines) currentBrandDetails.briefGuidelines = strategy.briefGuidelines;
      if (strategy.aiProfileContext) currentBrandDetails.aiProfileContext = strategy.aiProfileContext;

      await prisma.client.update({
        where: { id: Number(client_id) },
        data: { brand_details: currentBrandDetails }
      });
    }

    const dbContext = await buildContext(Number(client_id));
    
    let strategyContext = '';
    if (strategy) {
      let mixDataFormatted = '';
      if (strategy.contentMixData) {
        for (const [type, items] of Object.entries(strategy.contentMixData)) {
          const typeItems = items as any[];
          const validItems = typeItems.filter(item => Number(item.count) > 0);
          if (validItems.length > 0) {
            mixDataFormatted += `\n        ${type.toUpperCase()}:`;
            validItems.forEach((item, index) => {
              mixDataFormatted += `\n          - Instruction ${index + 1}: generate ${item.count} posts`;
              if (item.startDate) mixDataFormatted += ` | Date: ${item.startDate}`;
              if (item.description) mixDataFormatted += ` | Description/Focus: ${item.description}`;
            });
          }
        }
      }

      if (!mixDataFormatted) {
        mixDataFormatted = `\n        DEFAULT INSTRUCTION: Since no explicit counts were provided, generate exactly 12 mixed posts distributed evenly throughout the month. Ensure the titles explicitly include one of these formats: (Reel), (Carousel), (Stories), or (Static). Use the Creative Brief and AI Profile Context heavily to craft the descriptions.`;
      }

      strategyContext = `
      --- AI Strategy Planner Constraints ---
      Please strictly follow these strategy constraints provided by the user:
      - Goal: ${Array.isArray(strategy.goal) ? strategy.goal.join(', ') : strategy.goal}
      - Campaign Focus: ${Array.isArray(strategy.campaignFocus) ? strategy.campaignFocus.join(', ') : strategy.campaignFocus}
      - Platforms: ${strategy.platforms?.join(', ')}
      - Target Audience: ${strategy.targetAudience?.join(', ')}
      - Content Mix Requirements: ${mixDataFormatted}
      - Creative Brief / Brand Direction: ${strategy.briefGuidelines || 'None provided'}
      - Client AI Profile Context: ${strategy.aiProfileContext || 'None provided'}
      - Include Holidays: ${strategy.includeHolidays}
      - Include Trending: ${strategy.includeTrending}
      - Include Competitors: ${strategy.includeCompetitors}
      - Creativity Level: ${strategy.creativityLevel}
      
      CRITICAL INSTRUCTION: The user has provided an EXACT list of posts that MUST be included on specific dates with specific descriptions under the 'Content Mix Requirements'. 
      For each item in the Content Mix Requirements, you MUST create a calendar entry on the exact 'Date' specified.
      The 'title' MUST explicitly include the post format (e.g., 'Reel', 'Carousel', 'Stories', 'Static') in parentheses. For example: "Summer Solstice (Reel)" or "Product Feature (Static)". 
      Do NOT change these dates, do NOT invent random posts to replace them, and do NOT generate any filler or extra posts. You must ONLY output entries for the specific items requested in the Content Mix Requirements, plus any relevant holidays/events.
      ---------------------------------------
      `;
    }

    const targetMonthString = format(parseISO(`${month}-01`), 'MMMM yyyy');

    const prompt = `You are an expert AI social media strategist. Your job is to take the user's Content Mix Requirements and format them into a highly-researched JSON array for the TARGET MONTH: ${targetMonthString} (${month}). 
    
    Here is the client context extracted from their database:
    ${dbContext}
    ${strategyContext}

    Follow these instructions: ${instructions || 'Provide content based on the context provided.'}
    Also, automatically search for public holidays of India and major global special events for the TARGET MONTH: ${targetMonthString} (${month}), setting is_holiday to true.
    
    IMPORTANT RULES:
    1. ALL generated post dates MUST fall exactly within the TARGET MONTH. Never generate dates for past or future years.
    2. Exact Dates/Counts: Distribute the requested number of posts evenly throughout the TARGET MONTH unless a specific Date is provided.
    3. CONTENT PILLARS & CREATIVITY: Strongly align every post with the provided "Content Pillars". You MUST generate a highly detailed and creative 'description' for EVERY post. Do NOT leave it empty.
    4. INSTAGRAM PORTAL & REFERENCE LINKS: Actively analyze the provided 'Client Instagram Portal' to avoid duplicating existing themes. Use the 'Reference / Inspirational Links' to gauge trending formats, hashtags, and niche standards.
    5. DEDICATED FIELDS: For video formats (e.g. Reels), you MUST generate a 'transcript', 'hashtags', and 'reference_links' (inspiration links) in their dedicated JSON fields. To avoid broken/fake links, the 'reference_links' MUST be actual SEARCH URLs based on the post topic. Use exactly 3 to 5 of these formats, separated by commas:
       - Pinterest: https://www.pinterest.com/search/pins/?q=TOPIC
       - YouTube Shorts: https://www.youtube.com/results?search_query=TOPIC+shorts
       - Instagram: https://www.instagram.com/explore/tags/TOPIC/
       - LinkedIn: https://www.linkedin.com/search/results/content/?keywords=TOPIC
       - Reddit: https://www.reddit.com/search/?q=TOPIC
    6. Do NOT invent extra posts beyond the requested count (plus holidays).
    
    Ensure the output is valid JSON in the exact format: { "entries": [{ "date": "YYYY-MM-DD", "title": "Post Title (Format)", "description": "Caption text goes here", "transcript": "Transcript goes here", "hashtags": "#tag1 #tag2", "reference_links": "url1, url2, url3", "is_holiday": false }] }`;

    const generatedJson = await generateCalendarData(prompt, (model as AIModelType) || 'auto', (req as any).user.id);
    
    // Parse the JSON string
    let parsedData;
    try {
      parsedData = JSON.parse(generatedJson);
    } catch (e) {
      // Sometimes LLMs wrap JSON in Markdown code blocks
      const cleaned = generatedJson.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      parsedData = JSON.parse(cleaned);
    }

    // Save the generated entries into the database (unless preview is true)
    if (parsedData && Array.isArray(parsedData.entries)) {
      
      if (preview) {
        return res.status(200).json({
          message: 'Calendar preview generated successfully',
          data: parsedData.entries,
        });
      }

      const createdEntries = await Promise.all(
        parsedData.entries.map(async (item: any) => {
          return prisma.calendarEntry.create({
            data: {
              client_id: Number(client_id),
              date: parseISO(item.date),
              title: item.title,
              description: item.description,
              transcript: item.transcript,
              hashtags: item.hashtags,
              reference_links: item.reference_links,
              is_holiday: item.is_holiday || false,
            },
          });
        })
      );

      return res.status(200).json({
        message: 'Calendar generated and saved successfully',
        data: createdEntries,
      });
    } else {
      throw new Error('Invalid JSON format returned from AI');
    }
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    res.status(500).json({ message: error.message || 'Failed to generate calendar' });
  }
});

/**
 * @route POST /calendar/save-preview
 * @desc Save edited preview data directly to DB
 * @access Private
 */
router.post('/save-preview', authenticate, async (req, res) => {
  try {
    const { client_id, entries } = req.body;

    if (!client_id || !entries || !Array.isArray(entries)) {
      return res.status(400).json({ message: 'client_id and an array of entries are required' });
    }

    const createdEntries = await Promise.all(
      entries.map(async (item: any) => {
        return prisma.calendarEntry.create({
          data: {
            client_id: Number(client_id),
            date: parseISO(item.date),
            title: item.title,
            description: item.description,
            transcript: item.transcript,
            hashtags: item.hashtags,
            reference_links: item.reference_links,
            is_holiday: item.is_holiday || false,
          },
        });
      })
    );

    return res.status(200).json({
      message: 'Calendar preview saved successfully',
      data: createdEntries,
    });
  } catch (error: any) {
    console.error('Save Preview Error:', error);
    res.status(500).json({ message: error.message || 'Failed to save calendar preview' });
  }
});

/**
 * @route GET /calendar
 * @desc Get calendar entries
 * @access Private (All authenticated users)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { client_id, month, startDate, endDate } = req.query;
    const monthDate =
      typeof month === 'string' && month
        ? parseISO(month.length === 7 ? `${month}-01` : month)
        : null;

    const user = (req as any).user;
    const roleIds = user.roleIds || [];
    const roles = user.roles || [];
    const userId = user.id;

    const where: any = {
      client_id: client_id ? Number(client_id) : undefined,
      date: (startDate && endDate)
        ? {
            gte: parseISO(String(startDate)),
            lte: parseISO(String(endDate)),
          }
        : monthDate
        ? {
            gte: startOfMonth(monthDate),
            lte: endOfMonth(monthDate),
          }
        : undefined,
    };

    const isAdmin = roleIds.includes(1) || roles.includes('ADMIN');
    const isManager = roleIds.includes(2) || roles.includes('MANAGER');
    const isWorker =
      roleIds.includes(3) ||
      roleIds.includes(5) ||
      roleIds.includes(6) ||
      roles.some((r: string) => ['DESIGNER', 'VIDEOGRAPHER', 'EDITOR'].includes(r));

    if (isWorker && !isManager && !isAdmin) {
      where.task = { assigned_designer_id: userId, is_deleted: false };
    } else if (isManager && !isAdmin) {
      where.OR = [
        { task: null },
        { task: { created_by_manager_id: userId, is_deleted: false } }
      ];
    } else {
      where.OR = [
        { task: null },
        { task: { is_deleted: false } }
      ];
    }

    const entries = await prisma.calendarEntry.findMany({
      where,
      include: { client: true, task: { include: { status: true, task_type: true, task_types: true } } },
      orderBy: { date: 'asc' },
    });

    res.json({ data: entries });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route POST /calendar
 * @desc Create calendar entry (Manager/Admin only)
 * @access Private (Admin, Manager)
 */
router.post('/', authenticate, authorize([1, 2]), async (req, res) => {
  try {
    const {
      clientId,
      date,
      title,
      description,
      status = 'NOT_STARTED',
      priority = 2,
      assignedDesignerId,
      assignedRoleIds,
      taskTypeId,
      taskTypeIds,
      startDate,
      designerDueDate,
    } = req.body;

    if (!clientId || !date || !title) {
      return res.status(400).json({ message: 'clientId, date, and title are required' });
    }

    const publishDate = parseISO(String(date));
    const finalDesignerDueDate = designerDueDate ? parseISO(String(designerDueDate)) : publishDate;

    const statusRow = await prisma.taskStatus.upsert({
      where: { name: String(status).toUpperCase() },
      update: {},
      create: { name: String(status).toUpperCase() },
    });

    const entry = await prisma.calendarEntry.create({
      data: {
        client_id: Number(clientId),
        date: publishDate,
        title: String(title),
        description: description ? String(description) : null,
      },
    });

    const hasTaskTypeIds = taskTypeIds && Array.isArray(taskTypeIds) && taskTypeIds.length > 0;
    const primaryTaskTypeId = hasTaskTypeIds ? Number(taskTypeIds[0]) : (taskTypeId ? Number(taskTypeId) : null);
    const hasPlatformSpecs = req.body.platformSpecs && Array.isArray(req.body.platformSpecs) && req.body.platformSpecs.length > 0;

    const task = await prisma.task.create({
      data: {
        calendar_entry_id: entry.id,
        title: String(title),
        status_id: statusRow.id,
        priority: Number(priority) || 2,
        task_type_id: primaryTaskTypeId,
        task_types: hasTaskTypeIds 
          ? { connect: taskTypeIds.map((id: any) => ({ id: Number(id) })) }
          : (taskTypeId ? { connect: [{ id: Number(taskTypeId) }] } : undefined),
        start_date: startDate ? new Date(String(startDate)) : null,
        publish_date: publishDate,
        designer_due_date: finalDesignerDueDate,
        assigned_designer_id: assignedDesignerId ? Number(assignedDesignerId) : null,
        created_by_manager_id: (req as any).user.id,
        drive_link: req.body.driveLink || null,
        platform_specs: hasPlatformSpecs
          ? {
              create: req.body.platformSpecs.map((spec: any) => ({
                platform_id: Number(spec.platformId),
                post_specs: spec.postSpecs,
              }))
            }
          : undefined,
      },
      include: {
        status: true,
        assigned_designer: { select: { id: true, name: true, email: true } },
      },
    });
    if (assignedDesignerId && Number(assignedDesignerId) !== (req as any).user.id) {
      await createNotification({
        userId: Number(assignedDesignerId),
        title: 'Task Assigned',
        message: `You have been assigned to task "${title}"`,
        type: 'TASK_ASSIGNED',
        referenceId: task.id,
        referenceType: 'Task'
      });
    }

    res.status(201).json({
      message: 'Calendar entry and task created successfully',
      data: {
        ...entry,
        task,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create calendar entry' });
  }
});

/**
 * @route PATCH /calendar/:id
 * @desc Update calendar entry and sync linked task dates (Manager/Admin only)
 * @access Private (Admin, Manager)
 */
router.patch('/:id', authenticate, authorize([1, 2]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid calendar entry ID' });
    }

    const { date, title, description, designerDueDate } = req.body;

    const existing = await prisma.calendarEntry.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Calendar entry not found' });
    }

    const updatedDate = date ? parseISO(String(date)) : existing.date;

    const updatedEntry = await prisma.calendarEntry.update({
      where: { id },
      data: {
        date: updatedDate,
        title: title ? String(title) : undefined,
        description: description !== undefined ? (description ? String(description) : null) : undefined,
      },
      include: { task: true },
    });

    if (existing.task) {
      const finalDesignerDueDate = designerDueDate
        ? parseISO(String(designerDueDate))
        : (date ? updatedDate : undefined);
      await prisma.task.update({
        where: { id: existing.task.id },
        data: {
          publish_date: updatedDate,
          designer_due_date: finalDesignerDueDate,
          title: title ? String(title) : undefined,
        },
      });
    }

    res.status(200).json({
      message: 'Calendar entry updated and linked task dates synced successfully',
      data: updatedEntry,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update calendar entry' });
  }
});

/**
 * @route DELETE /calendar/:id
 * @desc Delete calendar entry and soft-delete linked task (Manager/Admin only)
 * @access Private (Admin, Manager)
 */
router.delete('/:id', authenticate, authorize([1, 2]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid calendar entry ID' });
    }

    const existing = await prisma.calendarEntry.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Calendar entry not found' });
    }

    if (existing.task) {
      await prisma.task.update({
        where: { id: existing.task.id },
        data: { is_deleted: true },
      });
    }

    await prisma.calendarEntry.delete({
      where: { id },
    });

    res.status(200).json({ success: true, message: 'Calendar entry deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete calendar entry' });
  }
});

export default router;
