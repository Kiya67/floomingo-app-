-- Insert demo profile if it doesn't exist
INSERT INTO "profiles" ("id", "username", "avatar_url", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'floomingo_demo', 'https://picsum.photos/seed/demouser/100/100', now(), now())
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- Insert 6 moments
INSERT INTO "moments" ("id", "user_id", "video_url", "thumbnail_url", "caption", "created_at") VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/moment1/400/600', 'Golden hour at the Amalfi Coast 🌅', now() - interval '1 day'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/moment2/400/600', 'Lost in the streets of Kyoto 🏯', now() - interval '2 days'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/moment3/400/600', 'Morning coffee in Paris ☕', now() - interval '3 days'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/moment4/400/600', 'Hiking the Dolomites at sunrise 🏔️', now() - interval '4 days'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/moment5/400/600', 'Street food tour in Bangkok 🍜', now() - interval '5 days'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/moment6/400/600', 'Sunset sail in Santorini ⛵', now() - interval '6 days');
--> statement-breakpoint

-- Insert 6 experiences
INSERT INTO "experiences" ("id", "user_id", "video_url", "thumbnail_url", "title", "description", "created_at") VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/exp1/400/600', 'A Week on the Amalfi Coast', 'Exploring hidden coves, local trattorias, and breathtaking cliff roads along Italy''s most dramatic coastline.', now() - interval '1 day'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/exp2/400/600', 'Kyoto in Cherry Blossom Season', 'Temples, tea ceremonies, and sakura-lined paths through Japan''s ancient capital.', now() - interval '2 days'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/exp3/400/600', 'Paris: Beyond the Eiffel Tower', 'Discovering the real Paris through its neighborhoods, markets, and hidden courtyards.', now() - interval '3 days'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/exp4/400/600', 'Dolomites Trekking Adventure', 'Three days of alpine trails, rifugios, and jaw-dropping panoramas in the Italian Alps.', now() - interval '4 days'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/exp5/400/600', 'Bangkok Street Food Guide', 'The ultimate guide to eating your way through Bangkok''s legendary street food scene.', now() - interval '5 days'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/exp6/400/600', 'Santorini Sailing & Sunsets', 'Sailing the caldera, swimming in volcanic hot springs, and watching the world-famous Oia sunset.', now() - interval '6 days');
--> statement-breakpoint

-- Insert sample places for moments
INSERT INTO "moment_places" ("id", "moment_id", "place_id", "place_name", "place_address")
SELECT gen_random_uuid(), id, 'ChIJ8ZmBl6LSmkYRZaXPV2T8gvE', 'Positano', 'Positano, Campania, Italy'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 5 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJI8aQDZbEsEYRUG_Mpa5I8-0', 'Amalfi Coast', 'Amalfi Coast, Campania, Italy'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 5 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ1YOHvxvXA2ARjUh-tPb0hQs', 'Kyoto', 'Kyoto, Kyoto Prefecture, Japan'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 4 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ2e9YCzPNABtKHCSMVrJVwdE', 'Fushimi Inari', 'Fushimi Inari, Kyoto, Japan'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 4 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJD7fiBh9u5OkQVLrP2XVAJAk', 'Paris', 'Paris, France'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 3 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJUeVhW6yq_4YRGmvBjUkz1YM', 'Montmartre', 'Montmartre, Paris, France'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 3 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJLU1EczlZhkYR9bSYR_u1K6M', 'Dolomites', 'Dolomites, Trentino-Alto Adige, Italy'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 2 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ2XKTRbpfhkYRJ6lFMp0hJrw', 'Tre Cime', 'Tre Cime di Lavaredo, Italy'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 2 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJb1pLKdxQA2ARpKFqlB3Bw3w', 'Bangkok', 'Bangkok, Thailand'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 1 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ1S4o-v3fHzAR0SQ8hZnMuDU', 'Chatuchak Market', 'Chatuchak Market, Bangkok, Thailand'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 1 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ6W3G9_qIZRYRpQ9x6LNtWu0', 'Santorini', 'Santorini, Cyclades, Greece'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 0 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ8_KqTrKKZRYRzF-XyNVNIB4', 'Oia', 'Oia, Santorini, Greece'
FROM "moments" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 0 LIMIT 1;
--> statement-breakpoint

-- Insert sample places for experiences
INSERT INTO "experience_places" ("id", "experience_id", "place_id", "place_name", "place_address")
SELECT gen_random_uuid(), id, 'ChIJ8ZmBl6LSmkYRZaXPV2T8gvE', 'Positano', 'Positano, Campania, Italy'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 5 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJI8aQDZbEsEYRUG_Mpa5I8-0', 'Amalfi Coast', 'Amalfi Coast, Campania, Italy'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 5 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ1YOHvxvXA2ARjUh-tPb0hQs', 'Kyoto', 'Kyoto, Kyoto Prefecture, Japan'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 4 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ2e9YCzPNABtKHCSMVrJVwdE', 'Fushimi Inari', 'Fushimi Inari, Kyoto, Japan'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 4 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJD7fiBh9u5OkQVLrP2XVAJAk', 'Paris', 'Paris, France'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 3 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJUeVhW6yq_4YRGmvBjUkz1YM', 'Montmartre', 'Montmartre, Paris, France'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 3 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJLU1EczlZhkYR9bSYR_u1K6M', 'Dolomites', 'Dolomites, Trentino-Alto Adige, Italy'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 2 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ2XKTRbpfhkYRJ6lFMp0hJrw', 'Tre Cime', 'Tre Cime di Lavaredo, Italy'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 2 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJb1pLKdxQA2ARpKFqlB3Bw3w', 'Bangkok', 'Bangkok, Thailand'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 1 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ1S4o-v3fHzAR0SQ8hZnMuDU', 'Chatuchak Market', 'Chatuchak Market, Bangkok, Thailand'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 1 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ6W3G9_qIZRYRpQ9x6LNtWu0', 'Santorini', 'Santorini, Cyclades, Greece'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 0 LIMIT 1
UNION ALL
SELECT gen_random_uuid(), id, 'ChIJ8_KqTrKKZRYRzF-XyNVNIB4', 'Oia', 'Oia, Santorini, Greece'
FROM "experiences" WHERE "user_id" = '00000000-0000-0000-0000-000000000001' ORDER BY "created_at" DESC OFFSET 0 LIMIT 1;
