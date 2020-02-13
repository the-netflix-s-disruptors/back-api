import { Router } from 'express';
import { authCheck } from './auth';
import { check, validationResult } from 'express-validator';
import fetch from 'node-fetch';

export default function MovieRoutes(): Router {
    const router = Router();

    router.get('/information/:id', authCheck, async (req, res) => {
        try {
            const url = `https://yts.mx/api/v2/movie_details.json?movie_id=${req.params.id}&with_cast=true`;
            const result = await fetch(url)
                .then(res => res.json())
                .then(res => res);
            if (result === null || result.data.movie === undefined) {
                res.json({ error: 'no result' });
                res.status(200);
                return;
            }

            const final = {
                id: result.data.movie.id,
                title: result.data.movie.title,
                year: result.data.movie.year,
                rating: result.data.movie.rating,
                gender: result.data.movie.genres,
                resume: result.data.movie.description_full,
                backgroundImage: result.data.movie.background_images,
                cover: result.data.movie.large_cover_image,
                casting: result.data.movie.cast,
                runtime: result.data.movie.runtime,
                trailer: `https://www.youtube.com/watch?v=${result.data.movie.yt_trailer_code}`,
            };
            res.json(final);
        } catch (e) {
            res.sendStatus(400);
        }
    });

    router
        .get('/comments/:id', authCheck, async (req: any, res: any) => {
            try {
                const db = res.locals.db;
                const {
                    rows,
                } = await db.query(`SELECT * FROM get_movie_comments($1)`, [
                    req.params.id,
                ]);
                res.json(rows);
            } catch (e) {
                console.error(e);
                res.sendStatus(400);
            }
        })
        .post(
            '/comments/:id',
            [
                check('payload')
                    .not()
                    .isEmpty()
                    .trim()
                    .isLength({ max: 142 }),
            ],
            authCheck,
            async (req: any, res: any) => {
                try {
                    const db = res.locals.db;

                    const errors = validationResult(req);
                    if (!errors.isEmpty()) {
                        return res.status(422).json({ errors: errors.array() });
                    }

                    const {
                        rowsCount,
                    } = await db.query(
                        `INSERT INTO comments (user_id, film_id, payload) VALUES ((SELECT id FROM users WHERE uuid = $1), $2, $3)`,
                        [req.user.uuid, req.params.id, req.body.payload]
                    );
                    if (rowsCount === 0) {
                        res.sendStatus(400);
                    }
                    res.status(200);
                    res.json({ status: 'SUCCESS' });
                } catch (e) {
                    console.error(e);
                    res.sendStatus(400);
                }
            }
        );

    // streaming part (will be really hard)

    return router;
}
