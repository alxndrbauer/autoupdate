// Manual jest mock for ConfigLoader default export used by tests
class ConfigLoader {
  githubToken() {
    return 'test-token';
  }

  dryRun() {
    return false;
  }

  pullRequestFilter() {
    return 'all';
  }

  pullRequestLabels() {
    return [];
  }

  excludedLabels() {
    return [];
  }

  mergeMsg() {
    return null;
  }

  conflictMsg() {
    return null;
  }

  retryCount() {
    return 3;
  }

  retrySleep() {
    return 1000;
  }

  mergeConflictAction() {
    return null;
  }

  githubRef() {
    return '';
  }

  githubRepository() {
    return '';
  }

  pullRequestReadyState() {
    return 'all';
  }

  scheduleBranches() {
    return [];
  }
}

export default new ConfigLoader();
