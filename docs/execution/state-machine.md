# Execution State Machine

The `ExecutionStateMachine` strictly governs valid lifecycle transitions for both the overall execution run and individual tasks.

## Execution Transitions

```text
created ──► running ──┬──► paused ──► running
                      ├──► waiting_approval ──► running
                      ├──► completed
                      ├──► failed
                      └──► cancelled
```

| From | Allowed Transitions |
|---|---|
| `created` | `running`, `cancelled` |
| `running` | `paused`, `waiting_approval`, `completed`, `failed`, `cancelled` |
| `paused` | `running`, `cancelled` |
| `waiting_approval` | `running`, `failed`, `cancelled` |
| `recovering` | `running`, `failed`, `cancelled` |
| `completed` | *(terminal)* |
| `failed` | *(terminal)* |
| `cancelled` | *(terminal)* |

## Task Transitions

```text
pending ──┬──► ready ──► running ──┬──► verifying ──┬──► completed
          │                        │                ├──► retrying ──► running
          ├──► waiting_approval    │                └──► failed
          │        │               ├──► failed
          │        ▼               ├──► skipped
          │      ready / running   └──► cancelled
          ├──► skipped
          └──► cancelled
```

| From | Allowed Transitions |
|---|---|
| `pending` | `ready`, `running`, `waiting_approval`, `skipped`, `cancelled` |
| `ready` | `running`, `waiting_approval`, `skipped`, `cancelled` |
| `running` | `waiting_approval`, `verifying`, `completed`, `failed`, `cancelled`, `retrying`, `skipped` |
| `waiting_approval` | `ready`, `running`, `failed`, `cancelled` |
| `verifying` | `completed`, `failed`, `retrying` |
| `retrying` | `running`, `failed`, `cancelled` |
| `completed` | *(terminal)* |
| `failed` | *(terminal)* |
| `skipped` | *(terminal)* |
| `cancelled` | *(terminal)* |
