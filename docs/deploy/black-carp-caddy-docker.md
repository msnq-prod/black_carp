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

## GitHub Actions secrets

Required repository secrets:

```text
SERVER_HOST
SERVER_USER
SERVER_SSH_KEY
```

The server user must be able to read/update `/srv/www/black-carp`.
