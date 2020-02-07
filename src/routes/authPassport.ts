import passport from 'passport';
import { OAuth2Strategy as google } from 'passport-google-oauth';
import { Strategy as fortyTow } from 'passport-42';
import { uuid } from 'uuidv4';

import { GOOGLE_CB, FORTYTOW_CB } from '../constants';
import { Database } from '../database';
const db = new Database();

passport.use(
    new google(
        {
            clientID: process.env.PASSPORT_GOOGLE_CLIENT_ID!,
            clientSecret: process.env.PASSPORT_GOOGLE_CLIENT_SECRET!,
            callbackURL: GOOGLE_CB,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const {
                    sub: id,
                    name: username,
                    email,
                    picture: photo,
                    given_name: givenName,
                    family_name: familyName,
                } = profile._json;

                const uuid1 = uuid();
                const {
                    rows: [user],
                } = await db.query(
                    `SELECT * FROM oauth_register($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        uuid1,
                        id,
                        'GOOGLE',
                        username,
                        email,
                        givenName,
                        familyName === undefined ? '' : familyName,
                        photo,
                    ]
                );
                console.log(user);
            } catch (err) {
                return done({ type: 'Auth', details: 'Failed', err });
            }
        }
    )
);

passport.use(
    new fortyTow(
        {
            clientID: process.env.PASSPORT_42_CLIENT_ID!,
            clientSecret: process.env.PASSPORT_42_CLIENT_SECRET!,
            callbackURL: FORTYTOW_CB,
        },
        async (
            accessToken: any,
            refreshToken: any,
            profile: any,
            done: any
        ) => {
            try {
                const {
                    id,
                    login: username,
                    email,
                    image_url: photo,
                    first_name: givenName,
                    last_name: familyName,
                } = profile._json;

                const uuid1 = uuid();
                const {
                    rows: [user],
                } = await db.query(
                    `SELECT * FROM oauth_register($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        uuid1,
                        id,
                        '42',
                        username,
                        email,
                        givenName,
                        familyName,
                        photo,
                    ]
                );
                console.log(user);
            } catch (err) {
                return done({ type: 'Auth', details: 'Failed', err });
            }
        }
    )
);

export { passport };
