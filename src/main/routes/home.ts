import { Status } from '../types/Status';

import axios from 'axios';
import { Application, Request, Response } from 'express';
import methodOverride from 'method-override';

const TASKS_API = 'http://localhost:4000/tasks';

export const formatStatus = (status?: string): string => {
  switch (status) {
    case 'IN_PROGRESS':
      return Status.IN_PROGRESS;
    case 'TODO':
      return Status.TODO;
    case 'COMPLETED':
      return Status.COMPLETED;
    default:
      return status || 'No Task';
  }
};

export const formatDueDate = (dueDate?: string): string => {
  if (!dueDate) {
    return '';
  }
  const [yyyyMMdd, hhMMss] = dueDate.split('T');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [yyyy, MM, dd] = yyyyMMdd.split('-');
  return `${dd}-${MM}-${yyyy} ${hhMMss} ${timeZone}`;
};

export const createTaskActions = (taskId?: string): string => {
  if (!taskId) {
    return '';
  }
  return `
              <a href="/tasks/${taskId || '0'}" class="govuk-link">View</a> |
              <a href="/tasks/${taskId || '0'}/edit" class="govuk-link">Edit</a> |
              <a href="/tasks/${taskId || '0'}?_method=DELETE" class="govuk-link">Delete</a>
            `;
};

export default function (app: Application): void {
  app.use(
    methodOverride((req: Request) => {
      return req.body._method || req.query._method;
    })
  );

  app.get('/', async (req: Request, res: Response) => {
    try {
      const response = await axios.get(`${TASKS_API}`);
      if (!Array.isArray(response.data)) {
        res.render('home', { rows: [], error: 'Tasks data is invalid' });
        return;
      }
      const rows =
        response.data.length > 0
          ? response.data
              .sort((a, b) => a.id - b.id)
              .map(task => {
                const actions = createTaskActions(task.id);

                return [
                  { text: task.id || 'N/A' },
                  { text: task.title || '' },
                  { text: task.description || '' },
                  { text: formatDueDate(task.dueDate) || '' },
                  { text: formatStatus(task.status) || '' },
                  { html: actions },
                ];
              })
          : [[{ text: 'N/A' }, { text: 'No tasks available' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }]];

      res.render('home', { rows });
    } catch (error) {
      const errorMessage = 'Failed to get task/s';
      res.render('home', { tasks: [], error: `${errorMessage}  ${error.message}` });
    }
  });

  app.get('/tasks/new', (req: Request, res: Response) => {
    res.render('task-form', { task: null });
  });

  app.get('/tasks/:id/edit', async (req: Request, res: Response) => {
    try {
      const response = await axios.get(`${TASKS_API}/${req.params.id}`);
      if (!response.data) {
        throw new Error('Task not found');
      }
      res.render('task-form', { task: response.data });
    } catch (error) {
      const errorMessage = 'Failed to edit task';
      res.status(404).render('not-found', { message: `${errorMessage} - ${error.message}` });
    }
  });

  app.post('/tasks', async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const taskData = {
        title: req.body.title,
        description: req.body.description,
        status: req.body.status || 'TODO',
        dueDate: req.body['due-date-day']
          ? new Date(
              Number(`${req.body['due-date-year']}`),
              Number(`${req.body['due-date-month']}`) - 1,
              Number(`${req.body['due-date-day']}`),
              now.getHours() + 1,
              now.getMinutes(),
              now.getSeconds()
            ).toISOString()
          : null,
      };
      await axios.post(`${TASKS_API}`, taskData);
      res.redirect('/');
    } catch (error) {
      let errorMessage = ' Failed to create task ';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = ' Connection Refused ';
      }
      if (error?.response?.data?.details) {
        errorMessage = error?.response?.data?.details?.dueDate || error?.response?.data?.error || errorMessage;
      }
      res.render('home', { task: req.body, error: `${errorMessage}` + `${error.message}` });
    }
  });

  app.get('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const response = await axios.get(`${TASKS_API}/${req.params.id}`);
      const task = response.data;
      task.status = formatStatus(task.status);
      task.dueDate = formatDueDate(task.dueDate);
      res.render('task-details', { task });
    } catch (error) {
      const errorMessage = `Failed to fetch task by ID', ${req.params.id} - ${error.message}`;
      res.render('not-found', { message: errorMessage });
    }
  });

  app.delete('/tasks/:id', async (req: Request, res: Response) => {
    try {
      await axios.delete(`${TASKS_API}/${req.params.id}`);
      res.redirect('/');
    } catch (error) {
      const errorMessage = 'Failed to delete task';
      res.render('home', { tasks: [], error: `${errorMessage} - ${error.message}` });
    }
  });

  app.patch('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const taskData = {
        status: req.body.status,
      };
      await axios.patch(`${TASKS_API}/${req.params.id}`, taskData);
      res.redirect('/');
    } catch (error) {
      const errorMessage = 'Failed to update task';
      res.render('task-form', { task: req.body, error: `${errorMessage} - ${error.message}` });
    }
  });
}
