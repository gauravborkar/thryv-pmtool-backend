import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { getBlackoutDates, addBlackoutDate, removeBlackoutDate } from '../controllers/calendar.controller';
import { addDays, endOfMonth, parseISO, startOfMonth } from 'date-fns';
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
    const { client_id, month, model, instructions, strategy, preview } = req.body;

    if (!client_id || !month) {
      return res.status(400).json({ message: 'client_id and month are required' });
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

      strategyContext = `
      --- AI Strategy Planner Constraints ---
      Please strictly follow these strategy constraints provided by the user:
      - Goal: ${strategy.goal}
      - Campaign Focus: ${strategy.campaignFocus}
      - Platforms: ${strategy.platforms?.join(', ')}
      - Target Audience: ${strategy.targetAudience?.join(', ')}
      - Content Mix Requirements: ${mixDataFormatted}
      - Include Holidays: ${strategy.includeHolidays}
      - Include Trending: ${strategy.includeTrending}
      - Include Competitors: ${strategy.includeCompetitors}
      - Creativity Level: ${strategy.creativityLevel}
      
      CRITICAL INSTRUCTION: The user has provided an EXACT list of posts that MUST be included on specific dates with specific descriptions under the 'Content Mix Requirements'. 
      For each item in the Content Mix Requirements, you MUST create a calendar entry on the exact 'Date' specified, with a title corresponding to the format (e.g. 'Reel', 'Carousel') and the exact description provided. 
      Do NOT change these dates, do NOT invent random posts to replace them, and do NOT generate any filler or extra posts. You must ONLY output entries for the specific items requested in the Content Mix Requirements, plus any relevant holidays/events.
      ---------------------------------------
      `;
    }

    const prompt = `You are a strict data-mapping AI assistant. Your ONLY job is to take the user's specific Content Mix Requirements and format them into a JSON array, along with any major public holidays for ${month}. 
    
    Here is the client context extracted from their database and spreadsheets:
    ${dbContext}
    ${strategyContext}

    Follow these instructions: ${instructions || 'Provide content based on the context provided.'}
    Also, automatically search for all the public holidays of India and major global/national special events (e.g. World Environment Day, Independence Day, etc.) for the month, and mark them by setting is_holiday to true and clearly name the event in the title.
    IMPORTANT: You must ONLY output the EXACT posts requested in the Content Mix Requirements. If the user asked for 3 specific posts, your JSON should contain EXACTLY those 3 posts (plus any holidays). DO NOT generate a post for every day. DO NOT invent your own posts. DO NOT pad the array with extra data.
    
    Ensure the output is valid JSON in the exact format: { "entries": [{ "date": "YYYY-MM-DD", "title": "Post Title", "description": "Post Description", "is_holiday": false }] }`;

    const generatedJson = await generateCalendarData(prompt, (model as AIModelType) || 'auto');
    
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
 * @route GET /calendar
 * @desc Get calendar entries
 * @access Private (All authenticated users)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { client_id, month } = req.query;
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
      date: monthDate
        ? {
            gte: startOfMonth(monthDate),
            lte: endOfMonth(monthDate),
          }
        : undefined,
    };

    if (roleIds.includes(3) || roles.includes('DESIGNER')) {
      where.task = { assigned_designer_id: userId, is_deleted: false };
    } else if (roleIds.includes(2) || roles.includes('MANAGER')) {
      where.task = { created_by_manager_id: userId, is_deleted: false };
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
    } = req.body;

    if (!clientId || !date || !title) {
      return res.status(400).json({ message: 'clientId, date, and title are required' });
    }

    const publishDate = parseISO(String(date));
    const designerDueDate = addDays(publishDate, -2);

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
        designer_due_date: designerDueDate,
        assigned_designer_id: assignedDesignerId ? Number(assignedDesignerId) : null,
        created_by_manager_id: (req as any).user.id,
        drive_link: req.body.driveLink || null,
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

    const { date, title, description } = req.body;

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
      const designerDueDate = addDays(updatedDate, -2);
      await prisma.task.update({
        where: { id: existing.task.id },
        data: {
          publish_date: updatedDate,
          designer_due_date: designerDueDate,
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
