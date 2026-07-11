# State Machines

## Current booking state (inferred)

```text
submitted
  -> awaiting_client_start
  -> client_linked
  -> in_review | need_details | consultation_offered | closed | spam
```

Problems:

- every callback status is allowed from every state;
- `master_notified`/`master_notify_failed`/`client_comment` are written as `to_status` history events without consistently becoming booking status;
- retry/cancel/partial notification behavior is not explicit;
- client `/start` can overwrite a status already changed by another path.

## Target CRM state

```text
new
  -> in_review
  -> need_details | approved | cancelled
need_details -> in_review | cancelled
approved -> scheduled | cancelled
scheduled -> done | cancelled
done (terminal)
cancelled (terminal, explicit reopen only)
```

Recommended rules:

- same-state write is idempotent and does not duplicate history;
- forbidden transitions return 409 with current state;
- schedule assignment transitions `approved -> scheduled` atomically;
- activity events never mutate status implicitly;
- client Telegram linking enriches contact but never rewinds CRM status.

## Notification state

```text
pending -> sending -> sent
                  -> retry_wait -> sending
                  -> failed_terminal
```

Each transition must persist attempts/error/next-attempt and be safe after process restart.
