FROM node:24-alpine as builder

RUN mkdir -p /opt/autoupdate/dist

WORKDIR /opt/autoupdate

COPY . /opt/autoupdate/

RUN npm ci --omit=dev && npm run build

FROM node:24-alpine as runner

LABEL com.github.actions.name="Auto-update pull requests with changes from their base branch"
LABEL com.github.actions.description="A GitHub Action that auto-updates PRs with changes from their base branch"
LABEL com.github.actions.icon="git-pull-request"
LABEL com.github.actions.color="blue"

RUN apk add --update --no-cache ca-certificates \
  && mkdir -p /opt/autoupdate

WORKDIR /opt/autoupdate

COPY --from=builder /opt/autoupdate/dist /opt/autoupdate
COPY --from=builder /opt/autoupdate/node_modules /opt/autoupdate/node_modules

ENTRYPOINT [ "node", "/opt/autoupdate/bin/cli.js" ]
