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