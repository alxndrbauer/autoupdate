import { Router } from '../src/router';
import { ConfigLoader } from '../src/config-loader';
import { WebhookEvent } from '@octokit/webhooks-types';

jest.mock('../src/autoupdater', () => ({
  AutoUpdater: jest.fn().mockImplementation(() => ({
    handlePullRequest: jest.fn().mockResolvedValue(true),
    handlePush: jest.fn().mockResolvedValue(0),
    handleWorkflowRun: jest.fn().mockResolvedValue(0),
    handleWorkflowDispatch: jest.fn().mockResolvedValue(0),
    handleSchedule: jest.fn().mockResolvedValue(0),
  })),
}));

describe('Router (fresh)', () => {
  const cfg = new ConfigLoader();
  const baseEvent = {} as WebhookEvent;

  test('routes supported events without throwing', async () => {
    const r = new Router(cfg, baseEvent);
    await r.route('pull_request');
    await r.route('push');
    await r.route('workflow_run');
    await r.route('workflow_dispatch');
    await r.route('schedule');
  });

  test('throws on unsupported event', async () => {
    const r = new Router(cfg, baseEvent);
    await expect(r.route('bogus')).rejects.toThrow(/Unknown event type/);
  });
});
