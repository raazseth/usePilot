// ─────────────────────────────────────────────────────────────────────────────
// Planner HTTP Routes
// GET /plans              — list recent plans
// GET /plans/:id          — get plan by ID
// GET /runs/:id           — get planner run by ID
// GET /conversations/:id/plans — list plans for a conversation
// ─────────────────────────────────────────────────────────────────────────────

import type { PlanRepository, PlannerRunRepository } from '@usepilot/database'

interface PlannerRepos {
  plans: PlanRepository
  runs: PlannerRunRepository
}

export function plannerRouter(repos: PlannerRepos) {
  return {
    async handle(req: Request, pathname: string): Promise<Response | null> {
      // GET /plans
      if (pathname === '/plans' && req.method === 'GET') {
        const url = new URL(req.url)
        const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 100)
        const rows = await repos.plans.listRecent(limit)
        return Response.json(rows.map((r) => {
          const bp = repos.plans.parseBlueprint(r)
          return {
            id: r.id,
            runId: r.runId,
            goalId: r.goalId,
            conversationId: r.conversationId,
            version: r.version,
            hash: r.hash,
            status: r.status,
            taskCount: bp.tasks.length,
            estimatedComplexity: bp.estimatedComplexity,
            primaryObjective: bp.goal.primaryObjective,
            planningDurationMs: r.planningDurationMs,
            createdAt: r.createdAt,
          }
        }))
      }

      // GET /plans/:id
      const planMatch = pathname.match(/^\/plans\/([^/]+)$/)
      if (planMatch && req.method === 'GET') {
        const id = planMatch[1]!
        const row = await repos.plans.findById(id)
        if (!row) return Response.json({ error: 'Plan not found' }, { status: 404 })
        return Response.json({
          ...row,
          executionBlueprint: repos.plans.parseBlueprint(row),
        })
      }

      // GET /runs/:id
      const runMatch = pathname.match(/^\/runs\/([^/]+)$/)
      if (runMatch && req.method === 'GET') {
        const id = runMatch[1]!
        const row = await repos.runs.findById(id)
        if (!row) return Response.json({ error: 'Run not found' }, { status: 404 })
        return Response.json(row)
      }

      // GET /conversations/:id/plans
      const convPlansMatch = pathname.match(/^\/conversations\/([^/]+)\/plans$/)
      if (convPlansMatch && req.method === 'GET') {
        const conversationId = convPlansMatch[1]!
        const rows = await repos.plans.listByConversation(conversationId)
        return Response.json(rows.map((r) => {
          const bp = repos.plans.parseBlueprint(r)
          return {
            id: r.id,
            version: r.version,
            hash: r.hash,
            status: r.status,
            taskCount: bp.tasks.length,
            estimatedComplexity: bp.estimatedComplexity,
            primaryObjective: bp.goal.primaryObjective,
            createdAt: r.createdAt,
          }
        }))
      }

      return null // not handled
    },
  }
}
