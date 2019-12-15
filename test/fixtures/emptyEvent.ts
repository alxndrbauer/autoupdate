import { WebhookEvent } from '@octokit/webhooks-types';
import { createMock } from '../helpers/ts-auto-mock-shim';

// Create an empty event for tests that don't need specific event data
export const createEmptyEvent = () => createMock<WebhookEvent>();
