import { Express } from 'express';

import AuthRoutes from './auth';
import UserRoutes from './user';

export default function Routes(server: Express) {
    server.use('/auth', AuthRoutes()).use('/user', UserRoutes());
}
