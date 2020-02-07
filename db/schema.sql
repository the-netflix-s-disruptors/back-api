CREATE TYPE "prefered_lg" AS ENUM (
    'FR',
    'EN'
);

CREATE TYPE "provider" AS ENUM (
    'LOCAL',
    'GOOGLE',
    '42'
);

CREATE TYPE "image_kind" AS ENUM (
    'LOCAL',
    'EXTERN'
);

CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,
    "uuid" uuid NOT NULL,
    "provider_id" numeric NOT NULL DEFAULT 0,
    "provider" provider NOT NULL,
    "username" text NOT NULL,
    "email" text NOT NULL,
    "given_name" text NOT NULL,
    "family_name" text NOT NULL,
    "prefered_lg" prefered_lg NOT NULL,
    "photo_id" int
);

CREATE TABLE "images" (
    "id" SERIAL PRIMARY KEY,
    "uuid" uuid NOT NULL,
    "kind" image_kind DEFAULT 'LOCAL',
    "src" text NOT NULL
);

ALTER TABLE "users"
ADD
    FOREIGN KEY ("photo_id") REFERENCES "images" ("id");

CREATE UNIQUE INDEX ON "users" ("uuid");
CREATE UNIQUE INDEX ON "users" ("username");
CREATE UNIQUE INDEX ON "users" ("email");
CREATE UNIQUE INDEX ON "users" ("provider_id");

CREATE UNIQUE INDEX ON "images" ("uuid");