# Swells API v1

Swells API v1 is a small, stable interface for connecting Swells to other
tools, automations and agents.

## Authentication

Create a key from **API access** in the Swells account menu. The full key starts
with `swl_v1_` and is shown once only.

Send it as a Bearer token:

```bash
curl https://swells.app/api/v1/spaces \
  -H "Authorization: Bearer swl_v1_your_key"
```

Keys act as the Swells user who created them. They do not create a separate
permissions model: a key can only reach spaces that user can already access,
and writes still respect the user's role, subscription state and monthly
observation limit.

Keys are stored as SHA-256 hashes. They can be revoked at any time and may have
an expiry date.

## Scopes

| Scope | Allows |
| --- | --- |
| `spaces:read` | List spaces the account can access |
| `observations:read` | Read approved observations |
| `observations:write` | Create an observation |
| `signals:read` | Read active signals |

A request without the required scope returns `403 insufficient_scope`.

## Endpoints

### List spaces

`GET /api/v1/spaces`

Requires `spaces:read`.

Returns each accessible space with the user's role in that space.

### List observations

`GET /api/v1/observations?spaceId=<uuid>&limit=30&cursor=<cursor>`

Requires `observations:read`.

- `spaceId` is required.
- `limit` defaults to 30 and may be 1–100.
- `cursor` is optional. When another page exists, use
  `meta.nextCursor` from the previous response.

Only approved observations are returned. AI fields may be null while a newly
created observation is still being processed.

### Create an observation

`POST /api/v1/observations`

Requires `observations:write`.

```json
{
  "spaceId": "00000000-0000-0000-0000-000000000000",
  "text": "A short observation worth noticing."
}
```

The API creates an ordinary Swells observation. It enters the same AI
processing and signal pipeline as an observation created in the Swells UI.
The API cannot create or edit signals directly.

A write can fail if the user cannot contribute to that space, their
subscription does not currently allow writes, or their monthly observation
limit has been reached.

### List signals

`GET /api/v1/signals?spaceId=<uuid>&limit=30&cursor=<cursor>`

Requires `signals:read`.

Returns active signals ordered by most recently updated.

## Responses

Successful list responses have this shape:

```json
{
  "data": [],
  "meta": {
    "version": "v1",
    "nextCursor": null
  }
}
```

Errors use:

```json
{
  "error": {
    "code": "invalid_api_key",
    "message": "Missing or invalid API key"
  }
}
```

Common status codes are `400` for invalid input, `401` for invalid or expired
keys, `403` for scope or space permission failures, and `429` for rate or
observation limits.

## Rate limit

API keys are currently limited to 120 requests per minute. Observation writes
are also subject to the account's normal monthly observation allowance.

## Versioning

The `/api/v1` path is the compatibility boundary. Backwards-incompatible
changes will use a new version rather than silently changing v1.


## Remote MCP

Swells also exposes the same stable capabilities over Streamable HTTP MCP:

`https://swells.app/mcp`

Use a normal Swells API v1 key as the Bearer credential. MCP discovery requires
`spaces:read`; individual tool calls still enforce their corresponding API
scope and the user's normal space permissions.

Tools:

- `swells_list_spaces`
- `swells_recent_observations`
- `swells_signals`
- `swells_create_observation`

The MCP endpoint is a transport over API v1, not a second permissions or data
model. Observation writes still enter the ordinary moderation/processing/signal
pipeline and cannot create Signals directly.
