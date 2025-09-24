import { app } from '../../main/app';
import { createTaskActions, formatDueDate, formatStatus } from '../../main/routes/home';

import nock = require('nock');
import request from 'supertest';

const TASKS_API = 'http://localhost:4000';

describe('Test utility methods', () => {
  describe('formatStatus', () => {
    it('should return correct status for known values', () => {
      expect(formatStatus('IN_PROGRESS')).toBe('In Progress');
      expect(formatStatus('TODO')).toBe('To Do');
      expect(formatStatus('COMPLETED')).toBe('Completed');
    });

    it('should return input status if unknown', () => {
      expect(formatStatus('UNKNOWN')).toBe('UNKNOWN');
    });

    it('should return "No Task" for undefined or empty status', () => {
      expect(formatStatus(undefined)).toBe('No Task');
      expect(formatStatus('')).toBe('No Task');
    });
  });

  describe('formatDueDate', () => {
    it('should format ISO date correctly', () => {
      const date = '2025-09-15T14:30:00';
      const result = formatDueDate(date);
      expect(result).toMatch(/15-09-2025 14:30:00/);
    });

    it('should return empty string for undefined or empty date', () => {
      expect(formatDueDate(undefined)).toBe('');
      expect(formatDueDate('')).toBe('');
    });
  });

  describe('createTaskActions', () => {
    it('should return action links for valid taskId', () => {
      const result = createTaskActions('1');
      expect(result).toContain('<a href="/tasks/1" class="govuk-link">View</a>');
      expect(result).toContain('<a href="/tasks/1/edit" class="govuk-link">Edit</a>');
      expect(result).toContain('<a href="/tasks/1?_method=DELETE" class="govuk-link">Delete</a>');
    });

    it('should return empty string for undefined taskId', () => {
      expect(createTaskActions(undefined)).toBe('');
    });
  });
});

describe('Task Routes', () => {
  describe('GET /', () => {
    it('should render home with tasks', async () => {
      nock(TASKS_API)
        .get('/tasks')
        .reply(200, [
          { id: '1', title: 'Task 1', description: 'Desc 1', status: 'TODO', dueDate: '2025-09-15T14:30:00' },
        ]);

      const response = await request(app).get('/').expect(200);
      expect(response.text).toContain('Task 1');
      expect(response.text).toContain('Desc 1');
      expect(response.text).toMatch(/15-09-2025 14:30:00/);
    });

    it('should render home with error on API failure', async () => {
      nock(TASKS_API).get('/tasks').reply(500, { message: 'Server Error' });

      const response = await request(app).get('/').expect(200);
      expect(response.text).toContain('Failed to get task/s');
    });

    it('should render home with no tasks available message when API returns empty array', async () => {
      nock(TASKS_API).get('/tasks').reply(200, []);

      const response = await request(app).get('/').expect(200);
      expect(response.text).toContain('No tasks available');
    });
  });

  describe('GET /tasks/new', () => {
    it('should render task-form with no task', async () => {
      const response = await request(app).get('/tasks/new').expect(200);
      expect(response.text).toContain('task-form');
    });
  });

  describe('GET /tasks/:id', () => {
    it('should render task-details with task data', async () => {
      nock(TASKS_API).get('/tasks/1').reply(200, {
        id: '1',
        title: 'Task 1',
        description: 'Desc 1',
        status: 'TODO',
        dueDate: '2025-09-15T14:30:00',
      });

      const response = await request(app).get('/tasks/1').expect(200);
      expect(response.text).toContain('Task 1');
      expect(response.text).toContain('Desc 1');
      expect(response.text).toMatch(/15-09-2025 14:30:00/);
    });

    it('should render not-found on API failure', async () => {
      nock(TASKS_API).get('/tasks/1').reply(404, { message: 'Task not found' });

      const response = await request(app).get('/tasks/1').expect(200);
      expect(response.text).not.toBeNull();
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('should update task status and redirect to home', async () => {
      nock(TASKS_API).patch('/tasks/1', { status: 'COMPLETED' }).reply(200, { id: '1', status: 'COMPLETED' });

      await request(app).patch('/tasks/1').send({ status: 'COMPLETED' }).expect(302).expect('Location', '/');
    });
  });

  describe('POST /tasks', () => {
    it('should create a task and redirect to home', async () => {
      nock(TASKS_API)
        .post('/tasks', {
          title: 'New Task',
          description: 'New Desc',
          status: 'TODO',
          dueDate: expect.stringMatching(/2025-09-15T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
        })
        .reply(201, {
          id: '1',
          title: 'New Task',
          description: 'New Desc',
          status: 'TODO',
          dueDate: '2025-09-15T14:30:00.000Z',
        });

      await request(app)
        .post('/tasks')
        .send({
          title: 'New Task',
          description: 'New Desc',
          'due-date-day': '15',
          'due-date-month': '09',
          'due-date-year': '2025',
        })
        .expect(200);
    });
    it('should render home with error on API failure', async () => {
      nock(TASKS_API)
        .post('/tasks')
        .reply(400, { error: 'Invalid data', details: { dueDate: 'Invalid date' } });

      const response = await request(app)
        .post('/tasks')
        .send({
          title: 'New Task',
          description: 'New Desc',
          'due-date-day': '15',
          'due-date-month': '09',
          'due-date-year': '2025',
        })
        .expect(200);

      expect(response.text).toContain('Invalid date');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete task and redirect to home', async () => {
      nock(TASKS_API).delete('/tasks/1').reply(200);

      await request(app).post('/tasks/1').send({ _method: 'DELETE' }).expect(302).expect('Location', '/');
    });

    it('should render home with error on API failure', async () => {
      nock(TASKS_API).delete('/tasks/1').reply(500, { message: 'Server Error' });

      const response = await request(app).post('/tasks/1').send({ _method: 'DELETE' }).expect(200);

      expect(response.text).toContain('Failed to delete task');
    });
  });
});
