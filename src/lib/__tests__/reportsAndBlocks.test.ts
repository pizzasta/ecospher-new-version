// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { BLOCK_HIDDEN_KEY, blockSignalAuthor, fileContentReport, filterVisibleSignalIds, loadBlockHidden, storeBlockHidden, unblockAllAuthors } from '../backendBridge'
import { CONTENT_REPORT_REASONS } from '../database.types'

describe('reports and blocks without a backend', () => {
  it('report reasons match the database check constraint', () => {
    expect([...CONTENT_REPORT_REASONS]).toEqual(['harassment', 'spam', 'unsafe content', 'sexual content', 'child safety', 'other'])
  })

  it('never claims a report was sent when nothing could be sent', async () => {
    await expect(fileContentReport('00000000-0000-4000-8000-000000000000', 'spam')).resolves.toBe(false)
    await expect(fileContentReport('local-demo-signal', 'harassment')).resolves.toBe(false)
  })

  it('never claims a block was saved when nothing could be saved', async () => {
    await expect(blockSignalAuthor('00000000-0000-4000-8000-000000000000')).resolves.toBe(false)
    await expect(blockSignalAuthor('not-a-uuid')).resolves.toBe(false)
    await expect(unblockAllAuthors()).resolves.toBe(false)
  })

  it('does not guess which signals are still visible without a backend', async () => {
    await expect(filterVisibleSignalIds(['00000000-0000-4000-8000-000000000000'])).resolves.toBeNull()
  })
})

describe('block-hidden signals are tracked separately', () => {
  it('round-trips ids and ignores junk in storage', () => {
    window.localStorage.removeItem(BLOCK_HIDDEN_KEY)
    expect(loadBlockHidden()).toEqual([])
    storeBlockHidden(['a', 'b'])
    expect(loadBlockHidden()).toEqual(['a', 'b'])
    window.localStorage.setItem(BLOCK_HIDDEN_KEY, JSON.stringify(['ok', 3, null]))
    expect(loadBlockHidden()).toEqual(['ok'])
    window.localStorage.setItem(BLOCK_HIDDEN_KEY, '{not json')
    expect(loadBlockHidden()).toEqual([])
    window.localStorage.removeItem(BLOCK_HIDDEN_KEY)
  })
})
