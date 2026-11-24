# dsh-live-teams

**A durable team of long-lived DSH Sessions — with owned tasks, independent review, and a human in control.**

`dsh-live-teams` turns DeepSeek Harness into a small working team. Each member is a real, persistent
DSH Session with a name, a role, and its own working context. Work is tracked as durable tasks; a
designated reviewer decides on an immutable submission; the lead and the human keep authority over
assignment, cancellation, and acceptance.

Unlike one-shot subagents, members keep their Session and role across tasks and restarts. Unlike a
chat-only workflow, every task, attempt, submission, and verdict survives a crash and can be
inspected later.

```text
DSH Desktop
├── Team tab ──────────────── tasks · members · activity
├── Lead / Builder / Reviewer Sessions
└── .dsh-live-teams/ ─────── team, tasks, attempts, submissions, reviews, mailbox
```

## Why this exists

A single coding agent is easy to start and hard to supervise. Once several agents work in parallel,
the important questions stop being "what code did it write?" and become:

- **Who owns this task, and who is allowed to accept it?**
- **What exactly was submitted, and what did the reviewer check?**
- **What happens to the work if a Session dies, a binding changes, or the app restarts?**
- **How does the human pause, correct, or stop the team without losing the audit trail?**

`dsh-live-teams` makes those questions part of the data model instead of leaving them to prompts and
chat messages.

## What you get

### Persistent members

A member is a long-lived DSH Session, not a temporary worker. It has a member id, display name, role,
availability, contact grants, and a binding generation. The human can open its Session directly and
talk to it; the lead can assign it work. Roles ship as editable Markdown files under `roles/`
(Lead, Builder, Reviewer, Verifier, Scout, Researcher, Oracle, Delegate).

### Durable tasks

Tasks live under `<workspace>/.dsh-live-teams` and move through an explicit lifecycle: `draft`,
`ready`, `claimed`, `in_progress`, `waiting`, `needs_human`, `completed`, `cancelled`. A task carries
its contract: title, acceptance criteria, declared paths, dependencies, route, round limit, and human
contact policy. Every attempt is recorded; a revision conflict is refused instead of silently
overwriting another agent's work.

### Independent review

A task can route to a named reviewer or report back to the lead. A submission is immutable: the
reviewer decides on exactly that submission, with findings and recorded evidence. The current
assignee cannot review their own work. A PASS completes the task; `needs_revision` returns it for
another round; `escalate` asks the lead for a decision. Round limits stop an endless review loop.

### Git-bound submissions

In a Git workspace, a submission is a commit built by the plugin from the paths the member declared,
not "whatever happened to be in the folder". Review is a commit range, integration is a
compare-and-swap against the base the work started from, and overlapping declared paths are
serialized before two writers can conflict. In non-Git folders the same lifecycle works from a tree
fingerprint.

### Reliable delivery

Messages and task handoffs go through a durable mailbox and command queue. Requests are deduplicated
by idempotency key, fenced by the member's binding generation, retried when a Session is temporarily
unavailable, and recovered after a restart. The team shows silence instead of pretending a message
was delivered.

### A Team tab built for supervision

The Team tab shows the active task queue, waiting and archived work, the member roster, and the
activity journal. Members can be added from an existing Session or created in the workspace; roles,
availability, names, and contact grants are editable. Dispatch can be paused. Tasks can be
created, claimed, released, revised, revoked, resumed, cancelled, and accepted from the panel.

### Human and lead authority

The human controls team composition and can intervene in any Session. The lead coordinates members
and is the default authority for acceptance and escalation. Contact between members is granted, not
implicit; the human is reached directly or through the lead. There is no hidden autonomous loop:
dispatch is visible, pausable, and coding dispatch is opt-in.

## Quick start

### Install

```bash
dsh plugin --profile <profile> add dsh-live-teams
```

Or install from GitHub:

```bash
dsh plugin --profile <profile> add github:Gdenich/dsh-live-teams
```

The package's Cordis patch inserts the row **disabled**. Installing the package must not start team
coordination by itself. Enable it in the profile, after the bundle layers:

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: live-teams
  disabled: false
  config:
    enabled: true
    # optional:
    # workspacePath: /absolute/path/to/your/project
    # codingDispatch: automatic
```

Then restart DSH. The profile layer is applied after every bundle layer; this override is enough.
Do not copy the package's own `insert` row into the profile.

Without `workspacePath`, the team is resolved from each Session's cwd, so one profile can serve
several workspaces. With it, the profile is pinned to one workspace.

If you launch DSH from a terminal, the package row also accepts environment variables:
`DSH_LIVE_TEAMS=1`, `DSH_LIVE_TEAMS_WORKSPACE`, `DSH_LIVE_TEAMS_TEAM_NAME`,
`DSH_LIVE_TEAMS_CODING`, and `DSH_LIVE_TEAMS_SCOPE_MODE`. A Desktop app launched from Finder does
not inherit shell exports; use the profile row there.

Open the workspace in DSH Desktop and select the **Team** tab.

### First task

1. Add at least a Lead and a Builder. A member can reuse an existing Session in this workspace or
   create a new one.
2. Create a task, assign it, give it acceptance criteria and declared paths, and route it to a
   reviewer.
3. The dispatcher starts the assigned work; the builder claims and acknowledges the task, does the
   work, and submits an artifact.
4. The reviewer records findings and evidence, then passes the submission or requests a revision.
5. The lead or human can accept, cancel, revoke, or resume work from the panel at any point.

## Configuration

| Profile key | Environment | Meaning | Default |
|---|---|---|---|
| `enabled` | `DSH_LIVE_TEAMS` | Enables the plugin row | `false` |
| `workspacePath` | `DSH_LIVE_TEAMS_WORKSPACE` | Absolute workspace path pinned to this team | Session cwd |
| `workspaceId` | `DSH_LIVE_TEAMS_WORKSPACE_ID` | Workspace id, when the workspace is already registered | derived |
| `teamId` | `DSH_LIVE_TEAMS_TEAM_ID` | Stable team id | derived from the workspace |
| `teamName` | `DSH_LIVE_TEAMS_TEAM_NAME` | Display name | workspace name |
| `codingDispatch` | `DSH_LIVE_TEAMS_CODING` | `automatic` allows the dispatcher to start coding tasks; `manual` only starts non-coding work | `manual` |
| `scopeMode` | `DSH_LIVE_TEAMS_SCOPE_MODE` | `auto`, `git`, or `files` — how changed paths are observed | `auto` |

Team state, tasks, submissions, reviews, and the activity journal are stored under
`<workspace>/.dsh-live-teams`. Do not edit those files by hand: the plugin validates and locks them.

### Automatic rotation (B43)

A member is a long-lived Session, so every turn re-sends its whole transcript. Measured on a real
team — 200 tasks, 7 700 model calls — the average prompt was ~460 000 tokens while a fresh Session
starts at ~19 000. Compaction does not fix that: it ran 53–102 times per heavy Session, the window
still settled around half a million tokens, and each compaction is itself a full-context call that
summarises away the exact ids and evidence the review protocol depends on.

Rotation replaces the Session, not the member record: a new Session is created, the rota (name, role,
note, standing contact grants, lead selection) moves onto it, and the old member id is archived. The
old Session stays readable, and the durable record — task documents, submissions, reviews, the
briefing, the member note — carries the memory. Because the member id changes, the completed-task
counter resets by construction.

| Profile key | Environment | Meaning | Default |
|---|---|---|---|
| `rotation.enabled` | `DSH_LIVE_TEAMS_ROTATION=1` | Enables automatic rotation | `false` |
| `rotation.maxContextTokens` | `DSH_LIVE_TEAMS_ROTATION_MAX_TOKENS` | Rotate when the last prompt reached this size; `0` disables the rule | `150000` |
| `rotation.maxCompletedTasks` | `DSH_LIVE_TEAMS_ROTATION_MAX_TASKS` | Rotate after this many accepted tasks; `0` disables the rule | `5` |
| `rotation.cooldownMs` | `DSH_LIVE_TEAMS_ROTATION_COOLDOWN_MS` | Quiet period after a refused rotation | `600000` |
| `rotation.maxRotationsPerPass` | `DSH_LIVE_TEAMS_ROTATION_MAX_PER_PASS` | Members replaced per dispatch pass — each one creates a Session | `1` |
| `rotation.excludeRoles` | `DSH_LIVE_TEAMS_ROTATION_EXCLUDE_ROLES` | Roles that are never rotated, comma-separated | `lead` |

The lead is excluded by default, and that default was measured rather than assumed. A coordinator's
state *is* the team: which tasks it closed, which decisions it made, what it already asked for. A
fresh coordinator with no memory rebuilds that from the archive — on this team a rotated lead spent
thirteen minutes and sixty calls listing the archive and reading sixteen accepted tasks, which is as
much as three hours of its normal work ($0.046 against $0.147 for nine hours). Workers lose little by
comparison: their state is the task document, which the new Session reads anyway.

Excluding a role is not the same as disabling rotation: the remaining members keep their limits, and
the excluded Session keeps a growing context until the host's own compaction bounds it. Set
`excludeRoles: []` to rotate the lead anyway, or add another role whose memory matters more than its
transcript.

Rotation can be configured in two places. The profile row above is the deployment default; the Team
tab's **Automatic rotation** card writes per-team overrides into `team.json`, so the human can turn it
on, change a limit, or turn it off again without editing YAML, and two teams in one profile can
differ. The card shows which layer is in force (`from profile` or `set in this team`) and commits
under the revision it was shown, exactly like the dispatch switch. A read or save failure is reported
inside the card rather than replacing the team-wide notice.

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: live-teams
  config:
    rotation:
      enabled: true
      maxContextTokens: 150000
      maxCompletedTasks: 5
```

`rotation: true` is accepted as the shorthand for "enabled, with the defaults above".

What a pass will never do, because the task contract, its review route and the attempt all name the
member id: rotate a member with an open task or an open review route, with an active attempt, while
its Session is running, while it has mail the host is about to push, or while it is `paused`. Mail
counts by wake policy, not by state alone: a `comment` carries `wakePolicy: 'never'`, waits for the
member's own next turn (days, on a busy team) and therefore cannot block — the first version counted
every `stored` delivery and froze a reviewer with 727k tokens of context on two comments from
yesterday. Parked comments are counted in the `member/rotated` event as `parkedMessages`, and the
mailbox records them as undelivered for the retired id on the next pass. Rotation runs inside the
dispatcher pass (not on its own timer) and only while the team is not paused, so the single-flight
latch, the shutdown path and the human's pause all cover it. Each rotation is recorded as a
`member/rotated` journal event with the member ids, both Session ids, the reason, the measured context,
the completed-task count, the carried model and the retired title; a Session that was created but whose
membership commit was refused is recorded as `session/orphaned` rather than silently dropped.

The replacement Session inherits the member's **model choice** as well. `session.create` accepts no
selection at all, so the pass reads the old Session's `model/selection` (or its last request header,
when no switch is pending) and records the same choice on the new Session. It deliberately does not go
through `sessionController.selectModel`: that call also persists the value as the deployment-wide
default model, so copying one member's model would silently re-model every other Session in the
profile. The choice that was carried is in the `member/rotated` journal event — "the lead got slower
after a rotation" is otherwise invisible, because the member name and role look identical on both
sides.

The replaced Session keeps a name of its own: it is retitled `<its current title> (Rotated
DD.MM.YYYY HH:mm)` in the host's local time, so the session list shows which of the two Sessions is
live. A name the human gave it is preserved — the stamp is appended, not substituted — and a title that
already carries one is left alone. A failed rename is reported and never fails the rotation: a title is
a convenience, the membership commit is the truth.

Rotation ships off and enabling it changes the team's composition, which is why the human's switch
exists rather than an always-on default. To see what it would do without enabling it, read the journal
after a pass or run the decision table in `src/rotation.test.ts`.

## Compatibility

- DSH Desktop **0.1.5-rc.1 or newer**.
- **0.2.2-rc.1 is verified** with the native checks B37, B38, B41, and B42.
- The plugin checks the host at mount and reports the result in its status, so an incompatible host
  is visible before work starts instead of failing one action at a time.
- Sessions routed through the Claude Code MCP bridge receive the matching `mcp__dsh__live_team_*`
  tool names; the bridge itself is a separate package.

## Security model

`dsh-live-teams` is a coordination layer, not a sandbox. Members are ordinary DSH Sessions and run
with the permissions the deployment gives them. The plugin enforces team authority, task ownership,
review routes, contact grants, and binding fences; it does not promise that a member cannot read or
write something its Session is otherwise allowed to touch.

Use it in trusted workspaces. If you need stronger isolation between coding agents, provide it at the
DSH deployment or workspace level; the plugin does not fake it.

## Current limitations

- One team per workspace; the state directory is the unit of ownership.
- Members share the workspace. There is no built-in worktree-per-task isolation.
- Coding dispatch is **manual by default**. Setting `DSH_LIVE_TEAMS_CODING=automatic` accepts the
  shared-tree risk for this deployment.
- Task `checks` are declarations, not a universal test runner. The reviewer is expected to run and
  record independent checks; a submitted claim is not system proof.
- Model selection is intentionally not exposed: changing it at this layer would also rewrite the
  deployment-wide default model.
- The project is early. Storage formats and tool schemas may change between releases; keep the
  workspace state under version control or back it up.

## Development

```bash
pnpm --filter dsh-live-teams check   # host and client types
pnpm --filter dsh-live-teams test    # 774 tests (8 known Windows-only failures)
pnpm --filter dsh-live-teams build   # host, client, declarations
```

Native host-composition checks live in the development tree rather than in the published package;
they boot an installed DSH Desktop with a disposable workspace and are run one check at a time.

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
