import { Router } from 'express';
import passport from 'passport';

export default function AuthRoutes(): Router {
    const router = Router();

    // GOOGLE STRAT
    router.get(
        '/google',
        passport.authenticate('google', { scope: ['email', 'profile'] })
    );

    router.get('/google/cb', passport.authenticate('google'), (req, res) => {
        console.log('all right');
    });

    // 42 STRAT
    router.get('/42', passport.authenticate('42'));

    router.get('/42/cb', passport.authenticate('42'), (req, res) => {
        console.log('all right');
    });
    return router;
}
