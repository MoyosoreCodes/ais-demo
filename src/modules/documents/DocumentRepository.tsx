import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { SelectField, TextAreaField, TextField } from '../../components/Field'
import { KpiCard } from '../../components/KpiCard'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { DEMO_TODAY, clientName, formatDate } from '../../lib/format'
import { placeholderImage } from '../../lib/sim'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import type { DigitizedDocument } from '../../lib/types'

const CATEGORIES: DigitizedDocument['category'][] = [
  'lease', 'permit', 'loan-file', 'lab-report', 'land-record', 'registration-form', 'correspondence',
]

/** Highlights the matched term inside an OCR extract. */
function Snippet({ text, term }: { text: string; term: string }) {
  const q = term.trim()
  if (!q) return <>{text.slice(0, 220)}…</>

  const index = text.toLowerCase().indexOf(q.toLowerCase())
  if (index === -1) return <>{text.slice(0, 220)}…</>

  const start = Math.max(0, index - 90)
  const end = Math.min(text.length, index + q.length + 130)
  return (
    <>
      {start > 0 && '…'}
      {text.slice(start, index)}
      <mark className="rounded bg-warn-100 px-0.5 font-semibold text-warn-900">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length, end)}
      {end < text.length && '…'}
    </>
  )
}

/**
 * S13 — digitized document repository and migration validation (xiv.1–xiv.6).
 *
 * Search runs over the extracted text as well as the metadata, which is the
 * point of xiv.4: an officer looking for a 2019 paper lease finds it by typing
 * what they remember, not by knowing its reference.
 */
export function DocumentRepository() {
  const db = useDb()
  const { role } = useAuth()

  const [tab, setTab] = useState('repository')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [batch, setBatch] = useState('all')
  const [validation, setValidation] = useState('all')
  const [selected, setSelected] = useState<DigitizedDocument | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.documents.filter((d) => {
      if (category !== 'all' && d.category !== category) return false
      if (batch !== 'all' && d.migrationBatch !== batch) return false
      if (validation !== 'all' && d.validation !== validation) return false
      if (!q) return true
      // Metadata *and* the extracted text — xiv.4 is about finding the content.
      const owner = d.clientId ? clientById.get(d.clientId) : undefined
      return [d.id, d.title, d.category, d.tags.join(' '), d.ocrText, owner ? clientName(owner) : '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [db.documents, clientById, query, category, batch, validation])

  const kpis = useMemo(() => {
    const totalPages = db.documents.reduce((s, d) => s + d.pages, 0)
    return {
      total: db.documents.length,
      pages: totalPages,
      indexed: db.documents.filter((d) => d.ocrText.length > 0).length,
      flagged: db.documents.filter((d) => d.validation !== 'pass').length,
      linked: db.documents.filter((d) => d.clientId).length,
      batches: db.migrationBatches.length,
    }
  }, [db.documents, db.migrationBatches])

  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of db.documents) for (const t of d.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22)
  }, [db.documents])

  return (
    <div className="pb-6">
      <PageHeader
        screen="S13"
        title="Digitized records"
        description="The scanning and migration programme: departmental paper records indexed, categorised and searchable by their content."
        refs={['xiv.2', 'xiv.4', 'xiv.6']}
        actions={
          can(role, 'documents.manage') ? (
            <button type="button" className="ais-btn-primary" onClick={() => setUploadOpen(true)}>
              Index a scanned document
              <ReqBadge refs="xiv.2" screen="S13" />
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Documents" value={kpis.total} hint={`${kpis.pages} pages scanned`} refs={['xiv.2']} screen="S13" />
        <KpiCard label="Full-text indexed" value={kpis.indexed} hint="Searchable by content" refs={['xiv.4']} screen="S13" tone="good" />
        <KpiCard label="Linked to a client" value={kpis.linked} hint="Resolve from the client profile" />
        <KpiCard label="Flagged in validation" value={kpis.flagged} hint="Warning or failure" tone={kpis.flagged ? 'warn' : 'good'} refs={['xiv.3']} screen="S13" onClick={() => setTab('migration')} />
        <KpiCard label="Migration batches" value={kpis.batches} hint="Profiled, cleansed, migrated" refs={['xiv.1']} screen="S13" onClick={() => setTab('migration')} />
      </div>

      <Tabs
        tabs={[
          { id: 'repository', label: 'Repository', count: db.documents.length },
          { id: 'migration', label: 'Migration validation', count: db.migrationBatches.length },
          { id: 'storage', label: 'Storage & access' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
      />

      {tab === 'repository' && (
        <>
          <div className="ais-card mb-3 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label htmlFor="doc-search" className="ais-label">
                  <span className="inline-flex items-center gap-1.5">
                    Search the repository
                    <ReqBadge refs="xiv.4" screen="S13" />
                  </span>
                </label>
                <input
                  id="doc-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Try “Riviere Doux”, “lease”, “Hoareau” or “fifteen metres”…"
                  className="ais-input"
                />
                <p className="ais-hint">
                  Searches the title, category, tags and the text extracted from the scan itself.
                </p>
              </div>
              <div>
                <label htmlFor="doc-category" className="ais-label">Category</label>
                <select id="doc-category" value={category} onChange={(e) => setCategory(e.target.value)} className="ais-input">
                  <option value="all">All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{statusLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="doc-batch" className="ais-label">Migration batch</label>
                <select id="doc-batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="ais-input">
                  <option value="all">All batches</option>
                  {db.migrationBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="doc-validation" className="ais-label">Validation</label>
                <select id="doc-validation" value={validation} onChange={(e) => setValidation(e.target.value)} className="ais-input">
                  <option value="all">Any result</option>
                  <option value="pass">Pass</option>
                  <option value="warn">Warning</option>
                  <option value="fail">Failure</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500">
                Index tags
                <ReqBadge refs="xiv.6" screen="S13" />
              </span>
              {tagCloud.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(tag)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                    query === tag
                      ? 'border-brand-500 bg-brand-600 text-white'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300'
                  }`}
                >
                  {tag} <span className="opacity-60">{count}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mb-3 text-sm text-ink-600">
            <strong className="text-ink-900">{filtered.length}</strong> of {db.documents.length}{' '}
            documents match
            {query.trim() && <> — search term highlighted in the extracted text below</>}
          </p>

          {filtered.length === 0 ? (
            <div className="ais-card">
              <EmptyState title="No documents match this search" body="Clear a filter, or try a word you remember from the document itself." />
            </div>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {filtered.map((d) => {
                const owner = d.clientId ? clientById.get(d.clientId) : undefined
                return (
                  <li key={d.id} className="ais-card p-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setSelected(d)}
                        className="shrink-0 overflow-hidden rounded border border-ink-200 hover:border-brand-400"
                        aria-label={`Open ${d.title}`}
                      >
                        <img
                          src={placeholderImage(d.swatch, d.id, 120, 160)}
                          alt={`${d.title} — generated placeholder scan`}
                          className="h-28 w-20 object-cover"
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelected(d)}
                            className="min-w-0 text-left text-sm font-semibold text-brand-700 hover:underline"
                          >
                            {d.title}
                          </button>
                          <StatusBadge status={d.validation} />
                        </div>
                        <p className="font-mono text-xs text-ink-500">
                          {d.id} · {statusLabel(d.category)} · {d.pages} pages · original {formatDate(d.originalDate)}
                        </p>
                        {owner && (
                          <p className="mt-0.5 text-xs">
                            <Link to={`/clients/${owner.id}`} className="text-brand-700 hover:underline">
                              {clientName(owner)} · {owner.id}
                            </Link>
                          </p>
                        )}
                        <ul className="mt-1.5 flex flex-wrap gap-1">
                          {d.tags.map((t) => (
                            <li key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <p className="mt-3 border-t border-ink-100 pt-2 text-xs leading-relaxed text-ink-600">
                      <Snippet text={d.ocrText} term={query} />
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'migration' && <MigrationTab />}
      {tab === 'storage' && <StorageTab />}

      {/* ------------------------------------------------ document viewer */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        size="lg"
        description={
          selected ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {selected.id} · {statusLabel(selected.category)} · {selected.pages} pages
              <SimChip label="generated placeholder scan" />
            </span>
          ) : undefined
        }
        footer={<button type="button" className="ais-btn-primary" onClick={() => setSelected(null)}>Close</button>}
      >
        {selected && (
          <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
            <img
              src={placeholderImage(selected.swatch, selected.id, 260, 350)}
              alt={`${selected.title} — generated placeholder scan`}
              className="w-full max-w-[220px] rounded border border-ink-200"
            />
            <div className="min-w-0 space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-ink-500">Original date</dt>
                  <dd className="text-ink-900">{formatDate(selected.originalDate)}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Scanned</dt>
                  <dd className="text-ink-900">{formatDate(selected.scannedOn)}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Migration batch</dt>
                  <dd className="font-mono text-ink-900">{selected.migrationBatch}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Validation</dt>
                  <dd><StatusBadge status={selected.validation} /></dd>
                </div>
              </dl>

              {selected.validationNote && (
                <p className="rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-800">
                  {selected.validationNote}
                </p>
              )}

              <div>
                <p className="ais-label mb-1">Index tags</p>
                <ul className="flex flex-wrap gap-1">
                  {selected.tags.map((t) => (
                    <li key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">{t}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="ais-label mb-1">Extracted text</p>
                <p className="max-h-52 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs leading-relaxed text-ink-700">
                  {selected.ocrText}
                </p>
                <p className="mt-1 text-[11px] text-ink-500">
                  This is what the search runs against. The image above is a generated placeholder —
                  no real departmental document is stored in the prototype.
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Migration validation (xiv.1, xiv.3 ★)
 * ------------------------------------------------------------------ */

function MigrationTab() {
  const db = useDb()

  const totals = useMemo(
    () =>
      db.migrationBatches.reduce(
        (acc, b) => ({
          read: acc.read + b.recordsRead,
          migrated: acc.migrated + b.recordsMigrated,
          rejected: acc.rejected + b.recordsRejected,
          checks: acc.checks + b.checks.length,
          failed: acc.failed + b.checks.filter((c) => c.result === 'fail').length,
          warned: acc.warned + b.checks.filter((c) => c.result === 'warn').length,
        }),
        { read: 0, migrated: 0, rejected: 0, checks: 0, failed: 0, warned: 0 },
      ),
    [db.migrationBatches],
  )

  return (
    <div>
      <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-900">
          Migration is verified, not asserted
          <ReqBadge refs={['xiv.1', 'xiv.3']} screen="S13" />
        </p>
        <p className="mt-1 text-sm text-brand-800">
          Each batch was profiled, cleansed and migrated, then checked automatically. The checks below
          compare what the source held against what the system now holds. A failure is reported rather
          than absorbed — {totals.failed} check{totals.failed === 1 ? '' : 's'} failed and{' '}
          {totals.warned} raised a warning across {totals.checks} checks, and the affected records are
          named.
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <KpiCard label="Records read" value={totals.read} hint="From the source systems" />
        <KpiCard label="Records migrated" value={totals.migrated} hint="Now in the registry" tone="good" />
        <KpiCard label="Rejected" value={totals.rejected} hint="Held for manual re-keying" tone={totals.rejected ? 'warn' : 'good'} />
        <KpiCard label="Checks failed" value={totals.failed} hint={`of ${totals.checks} automated checks`} tone={totals.failed ? 'bad' : 'good'} />
      </div>

      <div className="space-y-4">
        {db.migrationBatches.map((b) => {
          const failed = b.checks.filter((c) => c.result === 'fail').length
          const warned = b.checks.filter((c) => c.result === 'warn').length
          return (
            <section key={b.id} className="ais-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink-900">{b.name}</h2>
                  <p className="font-mono text-xs text-ink-500">{b.id} · run {formatDate(b.runOn)}</p>
                  <p className="mt-0.5 text-xs text-ink-600">Source: {b.source}</p>
                </div>
                <StatusBadge
                  status={failed ? 'fail' : warned ? 'warn' : 'pass'}
                  label={failed ? `${failed} failed` : warned ? `${warned} warnings` : 'All checks passed'}
                />
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { label: 'Read', value: b.recordsRead },
                  { label: 'Migrated', value: b.recordsMigrated },
                  { label: 'Rejected', value: b.recordsRejected },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-ink-200 p-2.5 text-center">
                    <dd className="text-lg font-semibold text-ink-900">{s.value}</dd>
                    <dt className="text-[11px] text-ink-500">{s.label}</dt>
                  </div>
                ))}
              </dl>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <caption className="sr-only">Validation checks for {b.name}</caption>
                  <thead>
                    <tr className="border-b border-ink-200 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-600">
                      <th scope="col" className="px-3 py-2 font-semibold">Check</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Expected</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Actual</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.checks.map((c) => (
                      <tr
                        key={c.id}
                        className={`border-b border-ink-100 last:border-0 ${
                          c.result === 'fail' ? 'bg-danger-50/50' : c.result === 'warn' ? 'bg-warn-50/50' : ''
                        }`}
                      >
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          <span className="block text-ink-900">{c.name}</span>
                          <span className="block text-xs text-ink-500">{c.description}</span>
                          {c.note && (
                            <span className="mt-0.5 block text-xs font-medium text-warn-700">{c.note}</span>
                          )}
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-700">{c.expected}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${c.expected !== c.actual ? 'font-semibold text-danger-700' : 'text-ink-700'}`}>
                          {c.actual}
                        </td>
                        <td className="px-3 py-2"><StatusBadge status={c.result} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Secure storage statement (xiv.5)
 * ------------------------------------------------------------------ */

function StorageTab() {
  const db = useDb()
  return (
    <div className="max-w-3xl space-y-4">
      <section className="ais-card p-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
          How digitized records are stored and reached
          <ReqBadge refs="xiv.5" screen="S13" />
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          What the delivered system does, and what this prototype does instead. Stating the
          difference is deliberate — the security controls below are a design commitment, not
          something a browser-only prototype can demonstrate.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">In the delivered system</p>
            <ul className="mt-2 space-y-1.5 text-sm text-brand-900">
              <li>· Scanned files encrypted at rest with AES-256.</li>
              <li>· Access mediated by the same role matrix as every other module.</li>
              <li>· Every retrieval written to the append-only audit log.</li>
              <li>· Nightly backup with off-site retention and restore testing.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-warn-200 bg-warn-50 p-3">
            <p className="inline-flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-warn-700">
              In this prototype <SimChip />
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-warn-900">
              <li>· No real document is stored; every “scan” is a generated placeholder.</li>
              <li>· Records live in browser storage only, and never leave the machine.</li>
              <li>· Repository access is gated by the real permission matrix.</li>
              <li>· <strong>Encryption at rest and backup are not demonstrated here.</strong></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="ais-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Who may reach the repository</h2>
        <ul className="space-y-1.5 text-sm text-ink-700">
          <li>· <strong>Search and read</strong> — every staff role holding <code className="rounded bg-ink-100 px-1 font-mono text-xs">documents.view</code>.</li>
          <li>· <strong>Index and manage</strong> — administrators only (<code className="rounded bg-ink-100 px-1 font-mono text-xs">documents.manage</code>).</li>
          <li>· <strong>Farmers</strong> — no direct repository access; documents relating to them surface on their own record.</li>
        </ul>
        <p className="mt-3 text-xs text-ink-500">
          {db.documents.filter((d) => d.clientId).length} of {db.documents.length} documents are
          linked to a client record, so they also appear on that client's Documents tab.
        </p>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Scan upload and indexing (xiv.2, xiv.6 ★)
 * ------------------------------------------------------------------ */

function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DigitizedDocument['category']>('lease')
  const [clientId, setClientId] = useState('')
  const [originalDate, setOriginalDate] = useState('')
  const [pages, setPages] = useState('4')
  const [tags, setTags] = useState('')
  const [ocrText, setOcrText] = useState('')

  const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
  const valid = title.trim().length > 5 && tagList.length >= 2 && ocrText.trim().length > 20

  const save = () => {
    if (!user || !valid) return
    const year = originalDate ? originalDate.slice(0, 4) : String(DEMO_TODAY.getUTCFullYear())
    const doc: DigitizedDocument = {
      id: `DOC-${year}-${String(db.documents.length + 200).padStart(4, '0')}`,
      title: title.trim(),
      category,
      clientId: clientId || undefined,
      originalDate: originalDate || DEMO_TODAY.toISOString().slice(0, 10),
      scannedOn: DEMO_TODAY.toISOString().slice(0, 10),
      scannedByUserId: user.id,
      pages: Number(pages) || 1,
      tags: tagList,
      ocrText: ocrText.trim(),
      migrationBatch: 'MIG-2026-C',
      validation: 'pass',
      swatch: `b${(db.documents.length % 4) + 1}`,
      simulated: true,
    }

    dispatch({
      type: 'document/create',
      document: doc,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'document.indexed', entityType: 'document', entityId: doc.id,
        detail: `Scanned document indexed — "${doc.title}" (${doc.pages} pages, ${tagList.length} tags)`,
      },
    })

    setTitle('')
    setTags('')
    setOcrText('')
    onClose()
    toast({
      tone: 'success',
      title: 'Document indexed',
      body: `${doc.id} is now searchable by its content.`,
      simulated: true,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Index a scanned document"
      size="lg"
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          Bulk scanning happens in the scanning programme; this records one document's index entry.
          <SimChip label="scan simulated" />
        </span>
      }
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={save} disabled={!valid}>
            Index document
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-800">
          No file is uploaded. The prototype records the index entry — title, category, tags, and the
          text a scanner's OCR would have produced — because that index is what makes the repository
          searchable. The page image is a generated placeholder.
        </p>

        <TextField
          label="Document title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Lease Agreement — Parcel PR/AB/1042 — M. Hoareau (2019)"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as DigitizedDocument['category'])}
            badge={<ReqBadge refs="xiv.6" screen="S13" />}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{statusLabel(c)}</option>
            ))}
          </SelectField>
          <SelectField label="Link to a client" value={clientId} onChange={(e) => setClientId(e.target.value)} hint="Optional — links the document to their record.">
            <option value="">Not linked</option>
            {db.clients
              .filter((c) => c.status !== 'merged')
              .slice(0, 80)
              .map((c) => (
                <option key={c.id} value={c.id}>{clientName(c)} · {c.id}</option>
              ))}
          </SelectField>
          <TextField label="Date of the original" type="date" value={originalDate} onChange={(e) => setOriginalDate(e.target.value)} />
          <TextField label="Pages" type="number" min="1" max="500" value={pages} onChange={(e) => setPages(e.target.value)} />
        </div>

        <TextField
          label="Index tags"
          required
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="lease, Anse Boileau, PR/AB/1042, 2019"
          hint={`Comma separated; at least two. ${tagList.length} entered.`}
          badge={<ReqBadge refs="xiv.6" screen="S13" />}
        />

        <TextAreaField
          label="Extracted text"
          required
          rows={6}
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          placeholder="The text a scanner's OCR produced from the pages. This is what full-text search runs against."
          hint={<span className="inline-flex items-center gap-1.5">Backs requirement xiv.4 <ReqBadge refs="xiv.4" screen="S13" /></span>}
        />
      </div>
    </Modal>
  )
}
