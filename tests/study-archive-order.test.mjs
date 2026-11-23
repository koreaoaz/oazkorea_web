import test from 'node:test'
import assert from 'node:assert/strict'
import { domTest, Image, loadSource } from './helpers/react-dom.mjs'

test('Study archive sorts across API batches before filtering and paginating', async () => domTest(async ({ render, container, act, window }) => {
  const terms = [[2024, 1], [2026, null], [null, 2], [2025, 2], [2026, 1], [2026, 2], [2026, 2], [2025, 1], [2024, 2], [2026, 2]]
  const rows = terms.map(([year, semester], i) => ({
    id: i + 1, year, semester, study_name: `Study ${i + 1}`, outline: '', filename: null,
    created_at: i === 0 ? '2027-01-09' : i === 5 ? '2026-01-09' : '2025-01-09',
  }))
  const supabase = { from: () => ({ select: () => ({ order: (field, options) => {
    assert.equal(field, 'id')
    assert.equal(options.ascending, true)
    let after = 0
    return {
      gt(column, cursor) { assert.equal(column, 'id'); after = cursor; return this },
      async abortSignal() {
        const remaining = rows.filter(row => row.id > after)
        return { data: remaining.slice(0, 3), count: remaining.length, error: null }
      },
    }
  } }) }) }
  const { default: Grid } = loadSource('src/components/home/features/StudyArchiveGrid.tsx', {
    '@/lib/supabaseClient': { supabase }, 'next/image': { __esModule: true, default: Image },
  }, { AbortSignal })
  await render(Grid)
  const ids = () => Array.from(container.querySelectorAll('[data-study-card]'), element => Number(element.dataset.studyCard))
  const filter = async value => act(async () => {
    const select = container.querySelector('select')
    select.value = value
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  assert.deepEqual(ids(), [6, 10, 7, 5, 4, 8])
  await act(async () => container.querySelector('[aria-label="Next page"]').click())
  assert.deepEqual(ids(), [9, 1, 3, 2])
  assert.deepEqual(Array.from(container.querySelectorAll('option:not([hidden])'),o=>o.value),['all','2026-2','2026-1','2025-2','2025-1','2024-2','2024-1'])
  await filter('2026-2')
  assert.deepEqual(ids(), [6,10,7])
  assert.equal(container.querySelector('[aria-label="Previous page"]').disabled,true)
  await filter('2025-2')
  assert.deepEqual(ids(), [4])
  await filter('all')
  assert.deepEqual(ids(), [6,10,7,5,4,8])
}))
