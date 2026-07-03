# Black Carp deploy

## Target layout

```text
/srv/www/black-carp
```

Caddy stays in the existing Docker compose project.

## Caddy Docker volume

Add a read-only bind mount to the Caddy service:

```yaml
volumes:
  - /srv/www/black-carp:/srv/www/black-carp:ro
```

## Caddyfile

Use the mounted path as the site root:

```caddy
black-carp.art {
  root * /srv/www/black-carp
  file_server
}
```

## Deployment

GitHub Actions connects to the production server as `blackcarp-deploy`.

That SSH key is restricted on the server with a forced command, so it can only run:

```text
/usr/local/bin/black-carp-deploy
```

The production server then pulls `main` from GitHub with its own read-only deploy key.

Required GitHub Actions secrets:

```text
SERVER_HOST
SERVER_USER
SERVER_SSH_KEY
```

Deploy script:

```text
/usr/local/bin/black-carp-deploy
```

## GitHub Actions

GitHub Actions only validates required static files:

```text
.github/workflows/validate.yml
```
