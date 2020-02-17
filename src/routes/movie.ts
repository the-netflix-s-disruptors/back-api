import { Router } from 'express';
import { authCheck } from './auth';
import { check, validationResult } from 'express-validator';
import fetch from 'node-fetch';
import torrentStream from 'torrent-stream';
import subApi from 'yifysubtitles-api';

import {
    getHash,
    getTorrentStream,
    beginStream,
    convertStream,
    downloadSub,
    extSub,
    convSub,
    getSubtitles,
} from './utils';
import { userInfo } from 'os';
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';

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

    //auth check
    router.get('/:id', async (req, res) => {
        try {
            // GET HASH OF THE MOVIE
            const info = await getHash(req.params.id);
            const magnet = `magnet:?xt=urn:btih:${info!.hash}&dn=${
                info!.url
            }&tr=http://track.one:1234/announce&tr=udp://track.two:80`;

            // START DOWNLOAD
            const engine = torrentStream(magnet, {
                connections: 100, // Max amount of peers to be connected to.
                uploads: 0, // Number of upload slots.
                // Defaults to '/tmp' or temp folder specific to your OS.
                // Each torrent will be placed into a separate folder under /tmp/torrent-stream/{infoHash}
                path: `public/${req.params.id}`, // Where to save the files. Overrides `tmp`.
                verify: true, // Verify previously stored data before starting
                trackers: [
                    'udp://tracker.openbittorrent.com:80',
                    'udp://tracker.ccc.de:80',
                    'udp://track.two:80',
                    'udp://open.demonii.com:1337/announce',
                    'udp://tracker.coppersurfer.tk:6969',
                    'udp://glotorrents.pw:6969/announce',
                    'udp://tracker.opentrackr.org:1337/announce',
                    'udp://torrent.gresille.org:80/announce',
                    'udp://p4p.arenabg.com:1337',
                    'udp://tracker.leechers-paradise.org:6969',
                    'udp://tracker.internetwarriors.net:1337',
                ], // Allows to declare additional custom trackers to use
            });

            const file: any = await getTorrentStream(engine);

            engine.on('download', (pieceIndex: number) => {
                console.log(`downloading ...`);
            });
            res.on('close', () => {
                engine.remove(true, () => {
                    engine.destroy(() => {});
                });
            });

            if (file.type === 'mp4' || file.type === 'webm') {
                beginStream(file, req, res);
            } else if (file.type === 'mkv') {
                convertStream(file, res);
                console.log('mkv');
            } else {
                res.sendStatus(400);
                return;
            }
        } catch (e) {
            console.error(e);
            res.sendStatus(400);
        }
    });

    // auth check
    router.get('/sub/:imdbId', authCheck, async (req: any, res) => {
        try {
            subApi
                .search({ imdbid: req.params.imdbId, limit: 'best' })
                .then(async (sub: any) => {
                    const setSub = async (lang: string) => {
                        const zip = await downloadSub(
                            sub[lang][0].url,
                            req.params.imdbId
                        );
                        const srt = await extSub(zip);
                        const vtt = await convSub(srt, req.params.imdbId, lang);
                    };

                    if (
                        sub['en'][0].url === null ||
                        sub['en'][0].url === undefined
                    ) {
                        res.json({ status: 'NO SUBS AVALIABLE' });
                        res.sendStatus(400);
                        return;
                    }

                    // EN SUB
                    await setSub('en');

                    // USER LANG SUB IF NOT EN
                    let subCount = 0;
                    if (req.user.preferedLg === 'FR' && sub['fr'][0].url) {
                        await setSub('fr');
                        subCount++;
                    }

                    // GET SUBS
                    const result: any = await getSubtitles(
                        req.params.imdbId,
                        req.user.preferedLg,
                        subCount !== 0 ? true : false
                    );
                    res.json(result);
                });
        } catch (e) {
            console.error(e);
            res.sendStatus(400);
        }
    });
    return router;
}
