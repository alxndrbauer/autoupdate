import * as octokit from '@octokit/types';
type PullRequestResponse =
  octokit.Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response'];

export const createPullRequest = (overrides = {}) =>
  ({
    number: 1,
    state: 'open',
    merged: false,
    head: {
      ref: 'develop',
      label: 'testowner:develop',
      repo: {
        owner: {
          login: 'testowner',
        },
        name: 'testrepo',
      },
    },
    base: {
      ref: 'main',
      label: 'testowner:main',
      repo: {
        owner: {
          login: 'testowner',
        },
        name: 'testrepo',
      },
    },
    labels: [],
    draft: false,
    auto_merge: null,
    ...overrides,
  }) as unknown as PullRequestResponse['data'];

export const createPullRequestWithLabels = (labels: string[]) =>
  createPullRequest({
    labels: labels.map((name, id) => ({ id, name })),
  });

export const createDraftPullRequest = () => createPullRequest({ draft: true });

export const createAutoMergePullRequest = () =>
  createPullRequest({
    auto_merge: {
      enabled_by: {
        login: 'testuser',
      },
      merge_method: 'squash',
    },
  });
