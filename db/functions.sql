 -- login or sign in user Oauth provider

 CREATE OR REPLACE FUNCTION oauth_register(uuid1 uuid, id numeric,  provider1 provider, username1 text, email1 text, given_name1 text, family_name1 text, photo1 text) 
        RETURNS TABLE (
            "uuid" uuid, 
            "provider_id" numeric, 
            "provider" provider, 
            "username" text, 
            "email" text,
            "given_name" text, 
            "family_name" text,
            "photo" text,  
            "prefered_lg" text
        ) 
AS $$
    DECLARE 
        id_photo integer;
        is_exist record;
    BEGIN
            
        SELECT users.id INTO is_exist FROM users WHERE users.provider_id = $2;

        IF is_exist IS NULL THEN
            INSERT INTO images (uuid, kind, src) VALUES ($1, 'EXTERN', $8) RETURNING images.id INTO id_photo;
            INSERT INTO
                users (
                    uuid,
                    provider_id,
                    provider,
                    username,
                    email,
                    given_name,
                    family_name,
                    photo_id,
                    prefered_lg
                )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                id_photo,
                'EN'::prefered_lg
            ) 
            ON CONFLICT DO NOTHING;
        END IF;

        RETURN QUERY
        SELECT
            users.uuid,
            users.provider_id,
            users.provider,
            users.username,
            users.email,
            users.given_name,
            users.family_name,
            ( SELECT src FROM images WHERE images.id = users.photo_id) as "photo",
            users.prefered_lg::text
        FROM
            users
        WHERE
            users.provider_id = $2;
    END;
 $$ LANGUAGE plpgsql;