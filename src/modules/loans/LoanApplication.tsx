import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DocUploader } from '../../components/DocUploader'
import { EmptyState } from '../../components/EmptyState'
import { SelectField, TextAreaField, TextField } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StageTracker } from '../../components/StageTracker'
import { DEMO_TODAY, clientName, formatHa, formatScr, localId, nextLoanId } from '../../lib/format'
import { composeNotification, templatesFor } from '../../lib/notify'
import { instantiate } from '../../lib/workflow'
import { ROLE_LABELS } from '../../lib/types'
import type { DocRef, Loan } from '../../lib/types'

const PURPOSES = [
  'Poultry house construction',
  'Irrigation system',
  'Greenhouse tunnel',
  'Seed and fertiliser inputs',
  'Fencing and land preparation',
  'Cold storage unit',
  'Piggery upgrade',
  'Drip irrigation and water tank',
  'Shade netting',
  'Farm vehicle',
]

const TERMS = [12, 24, 36, 48, 60]
const RATE_BY_TERM: Record<number, number> = { 12: 3.5, 24: 3.5, 36: 4.0, 48: 4.5, 60: 5.0 }

/**
 * S05 — online loan application (v.1, v.2).
 *
 * Reached from the farmer portal. The applicant's identity and holdings are
 * resolved from their client record, so nothing personal is re-entered; the
 * form asks only about the borrowing itself.
 */
export function LoanApplication() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const isFarmer = role === 'farmer'
  const [clientId, setClientId] = useState(user?.clientId ?? '')
  const [farmId, setFarmId] = useState('')
  const [purpose, setPurpose] = useState(PURPOSES[0])
  const [detail, setDetail] = useState('')
  const [amount, setAmount] = useState('')
  const [termMonths, setTermMonths] = useState(48)
  const [documents, setDocuments] = useState<DocRef[]>([])

  const workflow = db.workflows.find((w) => w.id === 'loan-approval')
  const client = db.clients.find((c) => c.id === clientId)
  const farms = useMemo(
    () => db.farms.filter((f) => f.clientId === clientId && f.status === 'registered'),
    [db.farms, clientId],
  )
  const farm = farms.find((f) => f.id === farmId) ?? farms[0]

  const eligibleClients = useMemo(
    () => db.clients.filter((c) => c.status !== 'merged' && db.farms.some((f) => f.clientId === c.id)),
    [db.clients, db.farms],
  )

  const amountValue = Number(amount)
  const amountValid = amountValue >= 5000 && amountValue <= 500000
  const canSubmit = Boolean(client && farm) && amountValid && purpose.length > 0

  const monthlyRepayment = useMemo(() => {
    if (!amountValid) return 0
    const rate = RATE_BY_TERM[termMonths] ?? 4.5
    const total = amountValue * (1 + (rate / 100) * (termMonths / 12))
    return Math.round(total / termMonths)
  }, [amountValue, amountValid, termMonths])

  if (!isFarmer && eligibleClients.length === 0) {
    return (
      <div className="ais-card">
        <EmptyState title="No client has a registered holding to lend against" />
      </div>
    )
  }

  if (isFarmer && !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="No client record linked to this account"
          body="An agriculture officer can link your portal account to your client record."
          action={<Link to="/portal" className="ais-btn-secondary">Back to my holding</Link>}
        />
      </div>
    )
  }

  if (farms.length === 0) {
    return (
      <div className="ais-card">
        <EmptyState
          title="No registered holding to lend against"
          body="A loan application must be attached to a registered farm. Register the holding first."
          action={
            <Link to={isFarmer ? '/portal' : '/farms/new'} className="ais-btn-secondary">
              {isFarmer ? 'Back to my holding' : 'Register a farm'}
            </Link>
          }
        />
      </div>
    )
  }

  const submit = () => {
    if (!user || !client || !farm || !workflow || !canSubmit) return

    const id = nextLoanId(db.loans.map((l) => l.id))
    const now = new Date().toISOString()
    const stages = instantiate(workflow)

    const loan: Loan = {
      id,
      clientId: client.id,
      farmId: farm.id,
      purpose: detail.trim() ? `${purpose} — ${detail.trim()}` : purpose,
      amountScr: amountValue,
      termMonths,
      interestRatePct: RATE_BY_TERM[termMonths] ?? 4.5,
      status: 'submitted',
      submittedOn: DEMO_TODAY.toISOString().slice(0, 10),
      workflowId: workflow.id,
      currentStageId: stages[0]?.stageId ?? null,
      stageInstances: stages,
      documents,
      history: [
        {
          id: localId('LH'),
          at: now,
          actorUserId: isFarmer ? 'SELF' : user.id,
          actorName: isFarmer ? clientName(client) : user.fullName,
          action: isFarmer
            ? 'Application submitted via farmer portal'
            : 'Application submitted by officer on behalf of the applicant',
          note: `${formatScr(amountValue)} over ${termMonths} months.`,
        },
        ...(documents.length
          ? [{
              id: localId('LH'), at: now,
              actorUserId: isFarmer ? 'SELF' : user.id,
              actorName: isFarmer ? clientName(client) : user.fullName,
              action: 'Supporting documents uploaded',
              note: `${documents.length} document${documents.length === 1 ? '' : 's'} attached.`,
            }]
          : []),
        {
          id: localId('LH'), at: now, actorUserId: 'SYSTEM', actorName: 'Workflow engine',
          action: `Routed to stage "${stages[0]?.name ?? ''}"`,
        },
      ],
    }

    dispatch({
      type: 'loan/create',
      loan,
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'loan.submitted',
        entityType: 'loan',
        entityId: id,
        detail: `Loan application submitted — ${formatScr(amountValue)} over ${termMonths} months for ${farm.name}`,
      },
    })

    for (const template of templatesFor(db.notificationTemplates, 'application.status.changed')) {
      if (template.channel === 'email' && !client.email) continue
      dispatch({
        type: 'notification/add',
        notification: composeNotification({
          template,
          client,
          vars: {
            applicationType: 'loan application',
            applicationId: id,
            status: 'submitted',
            detail: `Your application for ${formatScr(amountValue)} has been received and routed to ${stages[0]?.name.toLowerCase() ?? 'the first review stage'}.`,
          },
          relatedType: 'loan',
          relatedId: id,
        }),
      })
    }

    toast({
      tone: 'success',
      title: 'Application submitted',
      body: `${id} routed to "${stages[0]?.name ?? ''}". Confirmation sent.`,
      simulated: true,
    })
    navigate(`/loans/${id}`)
  }

  return (
    <div className="max-w-4xl pb-6">
      <PageHeader
        screen="S05"
        title="Apply for an agricultural loan"
        description="Your identity and holdings come from your client record — this form only asks about the borrowing itself."
        refs={['v.1']}
        actions={
          <Link to={isFarmer ? '/portal' : '/loans'} className="ais-btn-secondary">
            Cancel
          </Link>
        }
      />

      <div className="space-y-5">
        {/* ------------------------------------------------- applicant */}
        <section className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">Applicant and holding</h2>

          {!isFarmer && (
            <div className="mt-3">
              <SelectField
                label="Applicant"
                required
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value)
                  setFarmId('')
                }}
                hint="Officers may submit on behalf of an applicant who cannot use the portal."
              >
                <option value="">Select a client…</option>
                {eligibleClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientName(c)} · {c.id}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          {client && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="text-sm font-semibold text-ink-900">{clientName(client)}</p>
              <p className="font-mono text-xs text-ink-600">{client.id} · {client.nin}</p>
              <p className="mt-0.5 text-xs text-ink-600">
                {client.district}, {client.island} · {client.phone}
              </p>
            </div>
          )}

          <div className="mt-4">
            <SelectField
              label="Holding the loan relates to"
              required
              value={farm?.id ?? ''}
              onChange={(e) => setFarmId(e.target.value)}
              badge={<ReqBadge refs="v.1" screen="S05" />}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.id} · {formatHa(f.sizeHa)}
                </option>
              ))}
            </SelectField>
          </div>
        </section>

        {/* --------------------------------------------------- borrowing */}
        <section className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">What the loan is for</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <SelectField label="Purpose" required value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </SelectField>
            <TextField
              label="Amount requested"
              required
              type="number"
              min="5000"
              max="500000"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="85000"
              hint="Seychelles Rupees. Between SCR 5,000 and SCR 500,000."
              error={amount !== '' && !amountValid ? 'Enter an amount between SCR 5,000 and SCR 500,000.' : undefined}
            />
            <SelectField
              label="Repayment term"
              value={String(termMonths)}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              hint={`Indicative rate ${RATE_BY_TERM[termMonths] ?? 4.5}% for this term.`}
            >
              {TERMS.map((t) => (
                <option key={t} value={t}>{t} months</option>
              ))}
            </SelectField>
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Indicative monthly repayment
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {amountValid ? formatScr(monthlyRepayment) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                Simple interest, for guidance only. The committee sets the final terms.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <TextAreaField
              label="Additional detail"
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="e.g. 200 m² poultry house on the upper terrace, to raise capacity from 240 to 600 birds."
            />
          </div>
        </section>

        {/* --------------------------------------------------- documents */}
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Supporting documents
            <ReqBadge refs="v.2" screen="S05" />
          </h2>
          <DocUploader
            documents={documents}
            onAdd={(d) => setDocuments((prev) => [...prev, d])}
            onRemove={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
            uploadedBy={isFarmer ? 'SELF' : (user?.id ?? 'SYSTEM')}
            categories={['Identity', 'Business plan', 'Financial', 'Quotation', 'Tenure evidence', 'Other']}
            label="Attachments"
            hint="Identity, a business plan and three months of financial evidence are required before assessment. You can add them later, but assessment will flag anything missing."
          />
        </section>

        {/* ------------------------------------------------- what happens */}
        {workflow && (
          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              What happens next
              <ReqBadge refs={['v.3', 'v.4']} screen="S05" />
            </h2>
            <StageTracker stages={instantiate(workflow)} />
            <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
              {workflow.stages.map((s) => `${s.name} (${ROLE_LABELS[s.actorRole]}, ${s.slaDays} days)`).join(' → ')}.
              You are notified at each change of status.
            </p>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="ais-btn-primary" onClick={submit} disabled={!canSubmit}>
            Submit application
          </button>
          <Link to={isFarmer ? '/portal' : '/loans'} className="ais-btn-secondary">Cancel</Link>
          <span className="inline-flex items-center gap-2 text-xs text-ink-500">
            A confirmation is sent by SMS and email on submission
            <SimChip />
          </span>
        </div>
      </div>
    </div>
  )
}
