import { expect, afterAll } from 'vitest';

const API_BASE_URL = 'http://localhost:3001';

// Global list of tokens to clean up after tests
const tokensToCleanup: string[] = [];

// Flag to track if cleanup hook has been registered
let cleanupHookRegistered = false;

/**
 * Register cleanup hook on first use
 */
function registerCleanupHook() {
  if (cleanupHookRegistered) return;
  cleanupHookRegistered = true;

  afterAll(async () => {
    // Clean up test users
    for (const token of tokensToCleanup) {
      try {
        await deleteTestUser(token);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
}

/**
 * Make an unauthenticated API request
 */
export async function api(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = new URL(path, API_BASE_URL);
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });
}

/**
 * Make an authenticated API request with Bearer token
 */
export async function authenticatedApi(
  path: string,
  token: string,
  options?: RequestInit
): Promise<Response> {
  const url = new URL(path, API_BASE_URL);
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Assert response status matches one or more expected codes
 */
export async function expectStatus(
  res: Response,
  ...statuses: number[]
): Promise<void> {
  if (!statuses.includes(res.status)) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      body = '(unable to read body)';
    }

    console.error(
      `Expected status ${statuses.join(' or ')}, got ${res.status}. Body: ${body}`
    );
    expect(res.status).toBe(statuses.length === 1 ? statuses[0] : statuses);
  }
}

/**
 * Sign up a test user and return token + user data
 * Automatically registers cleanup hook
 */
export async function signUpTestUser(): Promise<{
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}> {
  registerCleanupHook();

  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `test-${uniqueId}@example.com`;
  const password = 'TestPassword123!';
  const name = `Test User ${uniqueId}`;

  // Sign up
  const signupRes = await api('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name,
    }),
  });

  if (!signupRes.ok) {
    const body = await signupRes.text();
    throw new Error(
      `Failed to sign up test user: ${signupRes.status} ${body}`
    );
  }

  const signupData = (await signupRes.json()) as any;
  const userId = signupData.user?.id;

  if (!userId) {
    throw new Error('No user ID in signup response');
  }

  // Sign in to get token
  const signinRes = await api('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!signinRes.ok) {
    const body = await signinRes.text();
    throw new Error(`Failed to sign in test user: ${signinRes.status} ${body}`);
  }

  const signinData = (await signinRes.json()) as any;
  const token = signinData.token || signinData.access_token;

  if (!token) {
    throw new Error('No token in signin response');
  }

  // Track token for cleanup
  tokensToCleanup.push(token);

  // Ensure profile and stats exist
  try {
    await authenticatedApi('/api/profile/ensure', token, {
      method: 'POST',
    });
  } catch {
    // Profile ensure might fail, but continue
  }

  return {
    token,
    user: {
      id: userId,
      email,
      name,
      ...signupData.user,
    },
  };
}

/**
 * Clean up test users by deleting their accounts
 */
export async function deleteTestUser(token: string): Promise<void> {
  try {
    const res = await authenticatedApi('/api/account/delete', token, {
      method: 'POST',
    });

    if (!res.ok) {
      console.warn(`Failed to delete test user: ${res.status}`);
    }
  } catch (error) {
    console.warn('Error deleting test user:', error);
  }
}

/**
 * Create a dummy test file for multipart uploads
 */
export function createTestFile(
  filename = 'test.txt',
  content = 'Test file content',
  type = 'text/plain'
): File {
  const blob = new Blob([content], { type });
  return new File([blob], filename, { type });
}

/**
 * Connect to an unauthenticated WebSocket endpoint
 */
export async function connectWebSocket(path: string): Promise<WebSocket> {
  const wsUrl = new URL(path, API_BASE_URL);
  wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl.toString());
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      ws.removeEventListener('open', onOpen);
      ws.removeEventListener('error', onError);
    };

    const onOpen = () => {
      cleanup();
      resolve(ws);
    };

    const onError = (event: Event) => {
      cleanup();
      reject(new Error(`WebSocket error: ${event}`));
    };

    ws.addEventListener('open', onOpen);
    ws.addEventListener('error', onError);

    // Timeout after 5 seconds
    timeoutId = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        cleanup();
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }
    }, 5000);
  });
}

/**
 * Connect to an authenticated WebSocket endpoint
 * Sends token as first message and waits for auth confirmation
 */
export async function connectAuthenticatedWebSocket(
  path: string,
  token: string
): Promise<WebSocket> {
  const ws = await connectWebSocket(path);

  // Send token as first message
  ws.send(JSON.stringify({ token }));

  // Wait for auth response
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;

    const messageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'auth' && data.authenticated === true) {
          if (timeoutId) clearTimeout(timeoutId);
          ws.removeEventListener('message', messageHandler);
          resolve(ws);
        } else if (data.type === 'auth' && data.authenticated === false) {
          if (timeoutId) clearTimeout(timeoutId);
          ws.removeEventListener('message', messageHandler);
          ws.close();
          reject(new Error('WebSocket authentication failed'));
        }
      } catch (error) {
        // Ignore parse errors, wait for auth message
      }
    };

    ws.addEventListener('message', messageHandler);

    // Timeout after 5 seconds
    timeoutId = setTimeout(() => {
      ws.removeEventListener('message', messageHandler);
      ws.close();
      reject(new Error('WebSocket auth timeout'));
    }, 5000);
  });
}

/**
 * Wait for the next message on a WebSocket
 */
export async function waitForMessage(
  ws: WebSocket,
  timeout = 5000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;

    const messageHandler = (event: MessageEvent) => {
      if (timeoutId) clearTimeout(timeoutId);
      ws.removeEventListener('message', messageHandler);
      resolve(event.data);
    };

    ws.addEventListener('message', messageHandler);

    timeoutId = setTimeout(() => {
      ws.removeEventListener('message', messageHandler);
      reject(new Error('Timeout waiting for WebSocket message'));
    }, timeout);
  });
}
