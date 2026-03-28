import { createApplication } from "@specific-dev/framework";
import { createClient } from "@supabase/supabase-js";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerBlockRoutes } from './routes/blocks.js';
import { registerBoardRoutes } from './routes/boards.js';
import { registerTripRoutes } from './routes/trips.js';
import { registerProfileStatsRoutes } from './routes/profile-stats.js';
import { registerPostRoutes } from './routes/posts.js';
import { registerFollowRoutes } from './routes/follows.js';
import { registerProfileRoutes } from './routes/profiles.js';
import { registerMomentRoutes } from './routes/moments.js';
import { registerExperienceRoutes } from './routes/experiences.js';

const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseAdmin: any = null;

if (!supabaseUrl || !supabaseServiceKey) {
  app.logger.warn('Supabase credentials not fully configured - storage features disabled');
} else {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}

// Initialize storage buckets
async function initializeStorageBuckets() {
  if (!supabaseAdmin) {
    app.logger.warn('Skipping storage bucket initialization - Supabase not configured');
    return;
  }

  try {
    // Create experiences bucket
    const experiencesBuckets = await supabaseAdmin.storage.listBuckets();
    const experiencesExists = experiencesBuckets.data?.some((b: any) => b.name === 'experiences');

    if (!experiencesExists) {
      await supabaseAdmin.storage.createBucket('experiences', {
        public: true,
        fileSizeLimit: 524288000, // 500MB
        allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/mov', 'video/avi', 'video/webm', 'video/*'],
      });
      app.logger.info('Created experiences storage bucket');
    }

    // Create thumbnails bucket
    const thumbnailsExists = experiencesBuckets.data?.some((b: any) => b.name === 'thumbnails');
    if (!thumbnailsExists) {
      await supabaseAdmin.storage.createBucket('thumbnails', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/*'],
      });
      app.logger.info('Created thumbnails storage bucket');
    }

    // Create moments bucket
    const momentsExists = experiencesBuckets.data?.some((b: any) => b.name === 'moments');
    if (!momentsExists) {
      await supabaseAdmin.storage.createBucket('moments', {
        public: true,
        fileSizeLimit: 524288000, // 500MB
        allowedMimeTypes: ['video/*'],
      });
      app.logger.info('Created moments storage bucket');
    }
  } catch (error: any) {
    // Buckets may already exist
    app.logger.warn({ err: error.message }, 'Storage bucket initialization warning');
  }
}

// Attach Supabase client to app context
(app as any).supabase = supabaseAdmin;

// Set up authentication
app.withAuth();

// Set up storage
app.withStorage();

// Initialize storage buckets after auth setup
await initializeStorageBuckets();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerBlockRoutes(app);
registerBoardRoutes(app);
registerTripRoutes(app);
registerProfileStatsRoutes(app);
registerPostRoutes(app);
registerFollowRoutes(app);
registerProfileRoutes(app);
registerMomentRoutes(app);
registerExperienceRoutes(app);

await app.run();
app.logger.info('Application running');
