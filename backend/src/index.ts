import { createApplication } from "@specific-dev/framework";
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

// Set up authentication
app.withAuth();

// Set up storage
app.withStorage();

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
