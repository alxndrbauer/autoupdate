import { WebhookEvent } from '@octokit/webhooks-types';
import { createMock } from '../helpers/ts-auto-mock-shim';

export const createPushEvent = (
  owner = 'testowner',
  repo = 'testrepo',
  branch = 'main',
) =>
  createMock<WebhookEvent>({
    ref: `refs/heads/${branch}`,
    repository: {
      owner: {
        login: owner,
      },
      name: repo,
    },
  });

export const createWorkflowDispatchEvent = (
  owner = 'testowner',
  repo = 'testrepo',
  branch = 'main',
) =>
  createMock<WebhookEvent>({
    ref: `refs/heads/${branch}`,
    repository: {
      owner: {
        login: owner,
      },
      name: repo,
    },
  });

export const createPullRequestEvent = (pullRequest: any) =>
  createMock<WebhookEvent>({
    pull_request: pullRequest,
  });
