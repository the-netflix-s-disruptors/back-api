import { Router } from 'express';
import { uuid } from 'uuidv4';
import { hash } from 'argon2';
import { check, validationResult } from 'express-validator';
import fileType from 'file-type';

import { authCheck } from './auth';
import { getExternalUser } from './utils';

export default function UserRoutes(): Router {
    const router = Router();

    // REGISTRATION
    router.post(
        '/registration',
        [
            check('email').isEmail(),
            check('username')
                .not()
                .isEmpty()
                .trim()
                .isLength({ min: 5 }),
            check('givenName')
                .not()
                .isEmpty()
                .trim()
                .isLength({ min: 2 }),
            check('familyName')
                .not()
                .isEmpty()
                .trim()
                .isLength({ min: 2 }),
            check('password')
                .not()
                .isEmpty()
                .matches(
                    /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,}$/,
                    'i'
                ),
        ],
        async (req: any, res: any) => {
            try {
                const db = res.locals.db;
                const cloud = res.locals.cloud;

                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(422).json({ errors: errors.array() });
                }

                // PHOTO
                if (
                    req.files === undefined ||
                    req.files.profile === undefined ||
                    Array.isArray(req.files.profile)
                ) {
                    return;
                }

                const fType = await fileType.fromBuffer(req.files.profile.data);
                const authorizeType = ['png', 'jpg', 'gif'];

                if (fType === undefined || !authorizeType.includes(fType.ext)) {
                    res.json({
                        status: 'FORBIDDEN FILE',
                    });
                    return;
                }

                const newPics = `${uuid()}.${fType.ext}`;
                await cloud.putObject(
                    'profile-pics',
                    newPics,
                    req.files.profile.data,
                    { 'Content-Type': fType.mime }
                );

                // TEXT
                const uuid1 = uuid();
                const token = uuid();
                const {
                    rows: [result],
                } = await db.query(
                    `SELECT * FROM insert_user($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        uuid1,
                        'LOCAL',
                        req.body.username,
                        req.body.email,
                        req.body.givenName,
                        req.body.familyName,
                        await hash(req.body.password),
                        newPics,
                        token,
                    ]
                );
                if (result.insert_user !== 1) res.sendStatus(400);

                // SEND EMAIL
                const url = `${uuid1}/${token}`;

                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );

    router.get('/registration/activate/:uuid/:token', async (req, res) => {
        const db = res.locals.db;

        try {
            const {
                rows: [result],
            } = await db.query(`SELECT * FROM activate_user($1, $2)`, [
                req.params.uuid,
                req.params.token,
            ]);

            if (result.activate_user !== 1) {
                res.sendStatus(400);
                return;
            }
            res.status(200);
            res.json({ status: 'SUCCESS' });
        } catch (e) {
            res.sendStatus(400);
        }
    });

    // RESETING PASSWORD
    router.post(
        '/reset',
        [check('email').isEmail()],
        async (req: any, res: any) => {
            const db = res.locals.db;

            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(422).json({ errors: errors.array() });
                }
                const token = uuid();
                const {
                    rows: [result],
                } = await db.query(`SELECT * FROM reset_user($1, $2)`, [
                    token,
                    req.body.email,
                ]);
                if (result.reset_user === 'NULL') {
                    res.sendStatus(400);
                    return;
                }

                // SEND EMAIL
                const url = `${result.reset_user}/${token}`;

                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );

    router.post(
        '/reset/activate/:uuid/:token',
        [
            check('password')
                .not()
                .isEmpty()
                .matches(
                    /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,}$/,
                    'i'
                ),
        ],
        async (req: any, res: any) => {
            const db = res.locals.db;

            try {
                const {
                    rows: [result],
                } = await db.query(
                    `SELECT * FROM activate_password($1, $2, $3)`,
                    [req.params.uuid, req.params.token, hash(req.body.password)]
                );

                if (result.activate_password !== 1) {
                    res.sendStatus(400);
                    return;
                }
                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );

    // PHOTO
    router.post('/changing/photo', authCheck, async (req: any, res: any) => {
        try {
            const db = res.locals.db;
            const cloud = res.locals.cloud;
            if (
                req.files === undefined ||
                req.files.profile === undefined ||
                Array.isArray(req.files.profile)
            ) {
                return;
            }

            const fType = await fileType.fromBuffer(req.files.profile.data);
            const authorizeType = ['png', 'jpg', 'gif'];

            if (fType === undefined || !authorizeType.includes(fType.ext)) {
                res.json({
                    status: 'FORBIDDEN FILE',
                });
                return;
            }

            const newPics = `${uuid()}.${fType.ext}`;

            // uplaod
            await cloud.putObject(
                'profile-pics',
                newPics,
                req.files.profile.data,
                { 'Content-Type': fType.mime }
            );

            // update
            await db.query(
                `UPDATE images SET src = $2, kind = 'LOCAL' WHERE images.id = (SELECT photo_id FROM users WHERE uuid = $1)`,
                [req.user.uuid, newPics]
            );
        } catch (e) {
            res.sendStatus(400);
        }
    });

    // USERNAME
    router.post(
        '/changing/username',
        authCheck,
        [
            check('username')
                .not()
                .isEmpty()
                .trim()
                .isLength({ min: 5 }),
        ],
        async (req: any, res: any) => {
            const db = res.locals.db;

            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(422).json({ errors: errors.array() });
                }

                const result = await db.query(
                    `UPDATE users SET users.username = $2 WHERE users.uuid = $1`,
                    [req.user.uuid, req.body.username]
                );

                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );

    // EMAIL
    router.post(
        '/changing/email',
        authCheck,
        [check('email').isEmail()],
        async (req: any, res: any) => {
            const db = res.locals.db;

            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(422).json({ errors: errors.array() });
                }

                const result = await db.query(
                    `UPDATE users SET users.email = $2 WHERE users.uuid = $1`,
                    [req.user.uuid, req.body.email]
                );

                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );

    // GIVEN NAME
    router.post(
        '/changing/givenname',
        authCheck,
        [
            check('givenName')
                .not()
                .isEmpty()
                .trim()
                .isLength({ min: 2 }),
        ],
        async (req: any, res: any) => {
            const db = res.locals.db;

            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(422).json({ errors: errors.array() });
                }

                const result = await db.query(
                    `UPDATE users SET users.given_name = $2 WHERE users.uuid = $1`,
                    [req.user.uuid, req.body.givenName]
                );

                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );
    // FAMILY NAME
    router.post(
        '/changing/familyname',
        authCheck,
        [
            check('familyName')
                .not()
                .isEmpty()
                .trim()
                .isLength({ min: 2 }),
        ],
        async (req: any, res: any) => {
            const db = res.locals.db;

            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(422).json({ errors: errors.array() });
                }

                const result = await db.query(
                    `UPDATE users SET users.family_name = $2 WHERE users.uuid = $1`,
                    [req.user.uuid, req.body.familyName]
                );

                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );

    // PASSWORD
    router.post(
        '/changing/password',
        authCheck,
        [
            check('password')
                .not()
                .isEmpty()
                .matches(
                    /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,}$/,
                    'i'
                ),
        ],
        async (req: any, res: any) => {
            const db = res.locals.db;

            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(422).json({ errors: errors.array() });
                }

                const result = await db.query(
                    `UPDATE users SET users.password = $2 WHERE users.uuid = $1`,
                    [req.user.uuid, req.body.password]
                );

                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );

    // PREFERED LG
    router.post(
        '/changing/preferedlg',
        authCheck,
        [
            check('preferedLg')
                .not()
                .isEmpty()
                .trim()
                .isLength({ min: 2, max: 2 }),
        ],
        async (req: any, res: any) => {
            const db = res.locals.db;

            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(422).json({ errors: errors.array() });
                }

                const result = await db.query(
                    `UPDATE users SET users.prefered_lg = $2 WHERE users.uuid = $1`,
                    [req.user.uuid, req.body.preferedLg]
                );

                res.status(200);
                res.json({ status: 'SUCCESS' });
            } catch (e) {
                res.sendStatus(400);
            }
        }
    );

    // RETURNING EXTERNAL USER
    router.get('/external/:uuid', authCheck, async (req, res) => {
        try {
            const user = await getExternalUser(req.params.uuid);
            res.status(200);
            res.json({ user });
        } catch (e) {
            res.sendStatus(400);
        }
    });
    return router;
}
