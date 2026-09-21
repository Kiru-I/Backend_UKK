import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import travelRoutes from './routes/travel';
import approvalRoutes from './routes/approval';
import fulfillmentRoutes from './routes/fulfillment';
import reimbursementRoutes from './routes/reimbursement';
import dashboardRoutes from './routes/dashboard';

const app = new Hono();

app.use('*', cors());

app.get('/uploads/*', async (c) => {
  const requestPath = c.req.path.replace(/^\/uploads\//, '');
  const filePath = `./uploads/${requestPath}`;
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return c.json({ error: 'Not Found', message: 'The requested file was not found.' }, 404);
  }

  const mimeType = file.type || 'application/octet-stream';
  return new Response(file, {
    headers: {
      'Content-Type': mimeType,
    },
  });
});

app.route('/api/auth', authRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/travels', travelRoutes);
app.route('/api/approvals', approvalRoutes);
app.route('/api/fulfillment', fulfillmentRoutes);
app.route('/api/reimbursements', reimbursementRoutes);
app.route('/api/dashboard', dashboardRoutes);

export default {
  port: Number(process.env.PORT || 3000),
  fetch: app.fetch,
};

export { app }; 