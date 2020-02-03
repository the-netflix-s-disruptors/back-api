import { Router } from 'express';

export default function AuthRoutes(): Router {
    const router = Router();

    router.get('/sign-in', (_req, res) => {
        res.send('SignIn');
    });

    return router;
}
