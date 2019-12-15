import 'jest-ts-auto-mock';
// Ensure no real HTTP requests are made from tests. nock will intercept the
// requests the tests expect; any unmatched network call will fail the test.
import nock from 'nock';

// Provide a lightweight fake for @actions/github.getOctokit so the code under
// test still makes HTTP requests that nock can intercept, but we avoid using
// the full Octokit implementation which caused compatibility issues.
import * as https from 'https';
import { URLSearchParams } from 'url';

function requestJson(method: string, path: string, body?: any): Promise<any> {
  const options: https.RequestOptions = {
    hostname: 'api.github.com',
    port: 443,
    path,
    method,
    headers: {
      'user-agent': 'node.js',
      accept: 'application/vnd.github.v3+json',
      'content-type': 'application/json',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => (data += chunk));
      res.on('end', () => {
        let parsed: any = null;
        try {
          parsed = data ? JSON.parse(data) : undefined;
        } catch (e) {
          // Return raw data if it's not JSON.
          return resolve({ status: res.statusCode, data: data });
        }
        const status = res.statusCode ?? 0;
        const parsedOrEmpty =
          parsed === undefined || parsed === null ? {} : parsed;
        // If the response was an error, mimic Octokit's behavior by rejecting
        // with an Error that contains a `status` property.
        if (status >= 400) {
          const msg =
            parsedOrEmpty && parsedOrEmpty.message
              ? parsedOrEmpty.message
              : `HTTP ${status}`;
          const err: any = new Error(msg);
          err.status = status;
          return reject(err);
        }

        resolve({ status, data: parsedOrEmpty });
      });
    });

    req.on('error', (err: any) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function createFakeOctokit() {
  return {
    rest: {
      repos: {
        compareCommitsWithBasehead: async ({ owner, repo, basehead }: any) =>
          await requestJson(
            'GET',
            `/repos/${owner}/${repo}/compare/${basehead}`,
          ),
        getBranch: async ({ owner, repo, branch }: any) =>
          await requestJson(
            'GET',
            `/repos/${owner}/${repo}/branches/${branch}`,
          ),
        merge: async ({ owner, repo, ...body }: any) =>
          await requestJson('POST', `/repos/${owner}/${repo}/merges`, body),
      },
      pulls: {
        list: {
          // emulate endpoint.merge by returning the same options object
          endpoint: { merge: (opts: any) => opts },
        },
      },
    },
    paginate: {
      iterator: async function* (paginatorOpts: any) {
        const qs = new URLSearchParams();
        if (paginatorOpts.base) qs.set('base', paginatorOpts.base);
        if (paginatorOpts.state) qs.set('state', paginatorOpts.state);
        if (paginatorOpts.sort) qs.set('sort', paginatorOpts.sort);
        if (paginatorOpts.direction)
          qs.set('direction', paginatorOpts.direction);

        const path = `/repos/${paginatorOpts.owner}/${paginatorOpts.repo}/pulls?${qs.toString()}`;
        const resp: any = await requestJson('GET', path);
        // yield a single page with the array under `data`
        yield { data: resp.data };
      },
    },
  };
}

jest.mock('@actions/github', () => ({
  getOctokit: (_token: string) => createFakeOctokit(),
}));

nock.disableNetConnect();
