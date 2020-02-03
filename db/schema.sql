CREATE TYPE "prefered_lg" AS ENUM (
    'FR',
    'EN'
);

CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,
    "uuid" uuid NOT NULL, 
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
    "src" text NOT NULL
);

ALTER TABLE "users"
ADD
    FOREIGN KEY ("photo_id") REFERENCES "images" ("id");

CREATE UNIQUE INDEX ON "users" ("uuid");
CREATE UNIQUE INDEX ON "users" ("username");
CREATE UNIQUE INDEX ON "users" ("email");

CREATE UNIQUE INDEX ON "images" ("uuid");