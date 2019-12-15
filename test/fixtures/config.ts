import nock from 'nock';
import { jest } from '@jest/globals';
import { ConfigLoader } from '../../src/config-loader';

export interface TestConfig {
  pullRequestFilter?: jest.Mock;
  pullRequestLabels?: jest.Mock;
  excludedLabels?: jest.Mock;
  dryRun?: jest.Mock;
  mergeMsg?: jest.Mock;
  conflictMsg?: jest.Mock;
  retryCount?: jest.Mock;
  retrySleep?: jest.Mock;
  mergeConflictAction?: jest.Mock;
  githubRepository?: jest.Mock;
  githubRef?: jest.Mock;
  pullRequestReadyState?: jest.Mock;
  githubToken?: jest.Mock;
}

export const createTestConfig = (overrides: TestConfig = {}) => {
  const config = {
    pullRequestFilter: jest.fn(),
    pullRequestLabels: jest.fn(),
    excludedLabels: jest.fn(),
    dryRun: jest.fn(),
    mergeMsg: jest.fn(),
    conflictMsg: jest.fn(),
    retryCount: jest.fn(),
    retrySleep: jest.fn(),
    mergeConflictAction: jest.fn(),
    githubRepository: jest.fn(),
    githubRef: jest.fn(),
    pullRequestReadyState: jest.fn(),
    githubToken: jest.fn(),
    ...overrides,
  };

  // Set default mock implementations
  config.pullRequestFilter.mockReturnValue('all');
  config.pullRequestLabels.mockReturnValue([]);
  config.excludedLabels.mockReturnValue([]);
  config.dryRun.mockReturnValue(false);
  config.retryCount.mockReturnValue(3);
  config.retrySleep.mockReturnValue(1000);
  config.mergeConflictAction.mockReturnValue(null);
  config.pullRequestReadyState.mockReturnValue('all');
  config.githubToken.mockReturnValue('dummy-token');

  return config as unknown as ConfigLoader;
};

interface GithubMockOptions {
  behindBy?: number;
  isProtected?: boolean;
  compareStatus?: number;
  branchStatus?: number;
}

export const setupGithubMock = (
  owner: string,
  repo: string,
  options: GithubMockOptions = {},
) => {
  const {
    behindBy = 1,
    isProtected = false,
    compareStatus = 200,
    branchStatus = 200,
  } = options;

  const compareMock = nock('https://api.github.com')
    .persist()
    .get(/\/repos\/.*\/compare\/.+\.\.\..+/i)
    .reply(compareStatus, { behind_by: behindBy });

  const branchMock = nock('https://api.github.com')
    .persist()
    .get(/\/repos\/.*\/branches\/.*/i)
    .reply(branchStatus, { protected: isProtected });

  nock.enableNetConnect();

  return { compareMock, branchMock };
};

export const cleanupMocks = () => {
  nock.cleanAll();
  jest.clearAllMocks();
};
