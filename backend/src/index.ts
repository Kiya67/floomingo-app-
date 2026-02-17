import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerBlockRoutes } from './routes/blocks.js';
import { registerBoardRoutes } from './routes/boards.js';

const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Set up authentication
app.withAuth();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerBlockRoutes(app);
registerBoardRoutes(app);

await app.run();
app.logger.info('Application running');
