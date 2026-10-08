import { describe, expect, it } from 'vitest'
import { blockSignalAuthor, fileContentReport, unblockAllAuthors } from '../backendBridge'
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
})
