import { Express } from 'express';

import AuthRoutes from './auth';

export default function Routes(server: Express) {
    server.use('/auth', AuthRoutes());
}
