# Task Model

## The Atomicity Rule

Each `Task` represents a single atomic executable unit of work:
**One Task = One Capability = One Action.**

The planner outputs abstract capabilities (`TaskCapability`), enabling the execution runtime to dynamically resolve the best concrete adapter for the host environment.

## Task Schema

```typescript
export interface Task {
  id: string
  title: string
  description: string
  category: TaskCategory
  requiredCapability: TaskCapability
  requiredTool?: TaskTool | undefined
  suggestedTool?: string | undefined
  toolConfig?: Record<string, unknown> | undefined
  expectedOutput?: string | undefined
  isOptional?: boolean | undefined
  preconditions: string[]
  postconditions: string[]
  successConditions: string[]
  failureConditions: string[]
  dependsOn: string[]
  approvalPolicy: ApprovalPolicy
  approvalReason?: string | undefined
  complexity: Complexity
  retryPolicy: RetryPolicy
  failureStrategy: FailureStrategy
  confidence: number
}
```

## Task Capabilities

The 17 canonical capabilities defined by `@usepilot/planner-types`:
- **Web & Browser**: `navigate_website`, `search_web`, `extract_web_data`, `authenticate_user`
- **Filesystem**: `download_file`, `read_file`, `write_file`, `move_file`, `delete_file`
- **System & Desktop**: `execute_command`, `read_clipboard`, `write_clipboard`
- **Communication & Network**: `send_communication`, `read_communication`, `call_api`
- **Computation & Verification**: `transform_data`, `verify_state`, `none`

## Tool Hints & Fallback

Tasks may include optional hints for tooling and UI grouping:
- `requiredTool`: Broad tool category (`browser`, `filesystem`, `email`, `terminal`, `clipboard`, `api`, `none`)
- `suggestedTool`: Specific recommended driver or library (e.g. `'playwright'`, `'native-fs'`)
- `expectedOutput`: Concrete expected artifact format (e.g. `'filepath: ~/Downloads/invoice.pdf'`)

