import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { SelectField, TextField } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { ReqBadge } from '../../components/ReqBadge'
import { StageTracker } from '../../components/StageTracker'
import { StatusBadge } from '../../components/StatusBadge'
import { DEMO_TODAY, formatDate } from '../../lib/format'
import { instantiate } from '../../lib/workflow'
import { ROLES, ROLE_LABELS } from '../../lib/types'
import type { Role, WorkflowDef, WorkflowStage } from '../../lib/types'

/** Roles that can plausibly hold an approval stage. */
const ACTOR_ROLES: Role[] = ROLES.filter((r) => r !== 'farmer')

const slugify = (name: string): string =>
  'stg-' +
  (name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'stage')

/**
 * S11 — approval workflow configurator (xi.6 ★).
 *
 * The definitions edited here are the same records `lib/workflow.ts` reads when
 * S04 and S05 route an application. Changing a stage therefore changes how the
 * *next* application is handled, with no code change and no redeployment —
 * applications already in flight keep the hierarchy they started under, which is
 * why the editor shows how many are affected before you save.
 */
export function WorkflowConfigurator() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()

  const [selectedId, setSelectedId] = useState(db.workflows[0]?.id ?? '')
  const [draft, setDraft] = useState<WorkflowStage[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const workflow = db.workflows.find((w) => w.id === selectedId)
  const stages = draft ?? workflow?.stages ?? []
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(workflow?.stages)

  /** Applications already running under this definition. */
  const inFlight = useMemo(() => {
    if (!workflow) return 0
    const open = (status: string) => ['submitted', 'under-review'].includes(status)
    return workflow.entity === 'loan'
      ? db.loans.filter((l) => l.workflowId === workflow.id && open(l.status)).length
      : db.landApplications.filter((a) => a.workflowId === workflow.id && open(a.status)).length
  }, [db.loans, db.landApplications, workflow])

  if (!workflow) {
    return <p className="text-sm text-ink-500">No workflow definitions are configured.</p>
  }

  const edit = (index: number, patch: Partial<WorkflowStage>) =>
    setDraft(stages.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= stages.length) return
    const next = [...stages]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setDraft(next)
  }

  const remove = (index: number) => setDraft(stages.filter((_, i) => i !== index))

  const addStage = (stage: WorkflowStage) => {
    setDraft([...stages, stage])
    setAddOpen(false)
  }

  const save = () => {
    if (!user || !draft) return
    const before = workflow.stages
    const changes: string[] = []

    if (before.length !== draft.length) {
      changes.push(`${before.length} → ${draft.length} stages`)
    }
    draft.forEach((s, i) => {
      const prior = before[i]
      if (!prior) {
        changes.push(`added "${s.name}" (${ROLE_LABELS[s.actorRole]})`)
        return
      }
      if (prior.id !== s.id) changes.push(`stage ${i + 1} is now "${s.name}"`)
      else {
        if (prior.name !== s.name) changes.push(`"${prior.name}" renamed to "${s.name}"`)
        if (prior.actorRole !== s.actorRole) {
          changes.push(`"${s.name}" actor ${ROLE_LABELS[prior.actorRole]} → ${ROLE_LABELS[s.actorRole]}`)
        }
        if (prior.slaDays !== s.slaDays) changes.push(`"${s.name}" service standard ${prior.slaDays} → ${s.slaDays} days`)
      }
    })
    for (const prior of before) {
      if (!draft.some((s) => s.id === prior.id)) changes.push(`removed "${prior.name}"`)
    }

    dispatch({
      type: 'workflow/update',
      id: workflow.id,
      patch: {
        stages: draft,
        updatedOn: DEMO_TODAY.toISOString().slice(0, 10),
        updatedByUserId: user.id,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'workflow.definition.updated',
        entityType: 'workflow',
        entityId: workflow.id,
        detail: `Approval hierarchy updated — ${changes.join('; ') || 'no material change'}`,
      },
    })

    setDraft(null)
    toast({
      tone: 'success',
      title: 'Approval hierarchy updated',
      body: `The next ${workflow.entity === 'loan' ? 'loan application' : 'land application'} will route through ${draft.length} stage${draft.length === 1 ? '' : 's'}.`,
    })
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
        <p className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-900">
          These definitions are what the router actually executes
          <ReqBadge refs={['xi.1', 'xi.6']} screen="S11" />
        </p>
        <p className="mt-1 text-sm text-brand-800">
          S04 and S05 read the stages below when they route an application. Change one and submit a
          new application — it follows the new hierarchy immediately, with no code change and no
          redeployment. Applications already in flight keep the hierarchy they started under.
        </p>
      </div>

      <div className="ais-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[240px] flex-1">
            <SelectField
              label="Workflow"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setDraft(null)
              }}
            >
              {db.workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.stages.length} stages)
                </option>
              ))}
            </SelectField>
          </div>
          <p className="mb-2 text-xs text-ink-500">
            Last changed {formatDate(workflow.updatedOn)} by{' '}
            {db.users.find((u) => u.id === workflow.updatedByUserId)?.fullName ?? workflow.updatedByUserId}
          </p>
        </div>

        {inFlight > 0 && (
          <p className="mt-3 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
            <strong>{inFlight} application{inFlight === 1 ? ' is' : 's are'} currently in flight</strong>{' '}
            under this definition. They keep the stages they started with; only new submissions use
            the edited hierarchy.
          </p>
        )}

        {/* ------------------------------------------------- stage editor */}
        <ol className="mt-4 space-y-3">
          {stages.map((stage, index) => (
            <li key={stage.id} className="rounded-lg border border-ink-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-ink-900">Stage {index + 1}</span>
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    className="ais-btn-secondary px-2 py-1 text-xs"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${stage.name} earlier`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="ais-btn-secondary px-2 py-1 text-xs"
                    onClick={() => move(index, 1)}
                    disabled={index === stages.length - 1}
                    aria-label={`Move ${stage.name} later`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ais-btn-secondary px-2 py-1 text-xs text-danger-700"
                    onClick={() => remove(index)}
                    disabled={stages.length <= 1}
                    title={stages.length <= 1 ? 'A workflow needs at least one stage' : undefined}
                  >
                    Remove
                  </button>
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Stage name"
                  value={stage.name}
                  onChange={(e) => edit(index, { name: e.target.value })}
                />
                <SelectField
                  label="Decided by"
                  value={stage.actorRole}
                  onChange={(e) => edit(index, { actorRole: e.target.value as Role })}
                  hint="Only a user holding this role sees the decision controls."
                >
                  {ACTOR_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </SelectField>
                <TextField
                  label="Service standard (days)"
                  type="number"
                  min="1"
                  max="180"
                  value={stage.slaDays}
                  onChange={(e) => edit(index, { slaDays: Number(e.target.value) })}
                />
                <TextField
                  label="Description"
                  value={stage.description}
                  onChange={(e) => edit(index, { description: e.target.value })}
                />
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="ais-btn-secondary" onClick={() => setAddOpen(true)}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
            Add a stage
          </button>
          <button type="button" className="ais-btn-primary" onClick={save} disabled={!dirty}>
            Save hierarchy
          </button>
          <button type="button" className="ais-btn-secondary" onClick={() => setDraft(null)} disabled={!dirty}>
            Discard changes
          </button>
          {dirty && (
            <p className="text-sm text-warn-700">Unsaved — the live hierarchy is still the previous one.</p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------- live preview */}
      <section className="ais-card mt-5 p-4">
        <h3 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
          How the next application will route
          <ReqBadge refs="xi.2" screen="S11" />
        </h3>
        <p className="mb-4 text-xs text-ink-500">
          Exactly what a farmer sees under “What happens next” when they submit.
        </p>
        <StageTracker stages={instantiate({ ...workflow, stages } as WorkflowDef)} />
        <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-500">
          {stages.map((s) => `${s.name} (${ROLE_LABELS[s.actorRole]}, ${s.slaDays} days)`).join(' → ')}.
          Total service standard {stages.reduce((sum, s) => sum + s.slaDays, 0)} days.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to={workflow.entity === 'loan' ? '/loans/apply' : '/land'}
            className="ais-btn-secondary px-3 py-1.5 text-xs"
          >
            {workflow.entity === 'loan' ? 'Submit a loan application and watch it route' : 'Open land management'}
          </Link>
          <Link to="/loans" className="ais-btn-secondary px-3 py-1.5 text-xs">
            Open the pipeline
          </Link>
        </div>
      </section>

      <AddStageDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addStage}
        existingIds={stages.map((s) => s.id)}
      />
    </div>
  )
}

function AddStageDialog({
  open, onClose, onAdd, existingIds,
}: {
  open: boolean
  onClose: () => void
  onAdd: (stage: WorkflowStage) => void
  existingIds: string[]
}) {
  const [name, setName] = useState('')
  const [actorRole, setActorRole] = useState<Role>('supervisor')
  const [slaDays, setSlaDays] = useState(7)
  const [description, setDescription] = useState('')

  const base = slugify(name)
  // Keep stage ids unique even if two stages are given the same name.
  let id = base
  let n = 2
  while (existingIds.includes(id)) id = `${base}-${n++}`

  const valid = name.trim().length > 2

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an approval stage"
      size="md"
      description="The new stage is appended; reorder it afterwards with the arrows."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="ais-btn-primary"
            disabled={!valid}
            onClick={() => {
              onAdd({ id, name: name.trim(), actorRole, slaDays, description: description.trim() })
              setName('')
              setDescription('')
            }}
          >
            Add stage
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Stage name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Director's endorsement"
          hint={valid ? <>Identifier <code className="rounded bg-ink-100 px-1 font-mono text-[11px]">{id}</code></> : undefined}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Decided by" value={actorRole} onChange={(e) => setActorRole(e.target.value as Role)}>
            {ACTOR_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </SelectField>
          <TextField
            label="Service standard (days)"
            type="number"
            min="1"
            max="180"
            value={slaDays}
            onChange={(e) => setSlaDays(Number(e.target.value))}
          />
        </div>
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this stage is for."
        />
        <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
          <StatusBadge status="pending" label="No redeployment" className="mr-1.5" />
          Adding a stage changes routing for the next submission only. Applications already in
          flight complete under the hierarchy they started with.
        </p>
      </div>
    </Modal>
  )
}
