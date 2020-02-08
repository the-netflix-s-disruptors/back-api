import { CLOUD_ENDPOINT, PROFILE_PICTURES_BUCKET } from '../constants';
import { Database } from '../database';

export function publicSrc(photo: string, photoKind: string) {
    if (photoKind === 'EXTERN') return photo;
    else return `${CLOUD_ENDPOINT}/${PROFILE_PICTURES_BUCKET}/${photo}`;
}

export async function getUser(uuid: string) {
    try {
        const db = new Database();

        const {
            rows: [result],
        } = await db.query(`SELECT * FROM get_user_by_uuid($1)`, [uuid]);
        const user = {
            ...result,
            photo: publicSrc(result.photo, result.photoKind),
        };
        return user;
    } catch (e) {
        return null;
    }
}

export async function getExternalUser(uuid: string) {
    try {
        const db = new Database();

        const {
            rows: [result],
        } = await db.query(`SELECT * FROM get_user_by_uuid($1)`, [uuid]);
        const user = {
            username: result.username,
            givenName: result.givenName,
            familyname: result.familyName,
            photo: publicSrc(result.photo, result.photoKind),
        };
        return user;
    } catch (e) {
        return null;
    }
}
