import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Library Management System API Integration Tests', () => {
  let authToken = '';

  it('GET /api/health should return status healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('POST /api/auth/login should fail with invalid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@apexlibrary.com',
      password: 'WrongPassword999',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/auth/login should succeed with default seeded credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@apexlibrary.com',
      password: 'Admin@123456',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.admin.email).toBe('admin@apexlibrary.com');
    authToken = res.body.token;
  });

  it('GET /api/dashboard/metrics should return key dashboard counters', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.students.total).toBeGreaterThanOrEqual(1);
    expect(res.body.seats.total).toBeGreaterThanOrEqual(1);
    expect(res.body.seats.shiftWise).toHaveLength(3); // 3 shifts
  });

  it('GET /api/seats/matrix should return seats with 3 independent shift states', async () => {
    const res = await request(app)
      .get('/api/seats/matrix')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.matrix.length).toBeGreaterThanOrEqual(1);

    const firstSeat = res.body.matrix[0];
    expect(firstSeat.shifts).toHaveLength(3);
    expect(firstSeat.shifts[0].statusColor).toBeDefined(); // GREEN or RED
  });

  it('GET /api/students should return seeded student directory', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.students.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/fees/invoices should return invoices list', async () => {
    const res = await request(app)
      .get('/api/fees/invoices')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.invoices.length).toBeGreaterThanOrEqual(1);
  });
});

