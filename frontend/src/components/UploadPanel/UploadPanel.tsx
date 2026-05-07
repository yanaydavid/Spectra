import { useRef, useState } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'
import { parseDatasheet } from '../../api/parseDatasheet'
import { ExtractionReview } from './ExtractionReview'
import { LoadingSpinner } from '../shared/LoadingSpinner'
import type { ExtractedParams } from '../../types'

export function UploadPanel() {
  const isExtracting = useSpectraStore((s) => s.isExtracting)
  const extractionError = useSpectraStore((s) => s.extractionError)
  const setExtracting = useSpectraStore((s) => s.setExtracting)
  const setExtractionError = useSpectraStore((s) => s.setExtractionError)

  const [extracted, setExtracted] = useState<ExtractedParams | null>(null)
  const [filename, setFilename] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setExtractionError('Only PDF files are supported')
      return
    }
    setFilename(file.name)
    setExtracting(true)
    setExtractionError(null)
    setExtracted(null)
    try {
      const result = await parseDatasheet(file)
      setExtracted(result)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Extraction failed'
      setExtractionError(msg)
    } finally {
      setExtracting(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  if (extracted) {
    return (
      <ExtractionReview
        extracted={extracted}
        filename={filename}
        onDone={() => setExtracted(null)}
      />
    )
  }

  return (
    <div className="p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Upload Datasheet
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragging ? 'border-violet-500 bg-violet-500/10' : 'border-gray-700 hover:border-gray-500'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleChange}
        />
        {isExtracting ? (
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size={24} />
            <p className="text-xs text-gray-400">Extracting parameters…</p>
          </div>
        ) : (
          <>
            <p className="text-2xl mb-1">📄</p>
            <p className="text-sm text-gray-400">Drop PDF datasheet here</p>
            <p className="text-xs text-gray-600 mt-1">or click to browse</p>
          </>
        )}
      </div>

      {extractionError && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-400 bg-red-400/10 rounded p-2">
          <span>⚠</span>
          <span>{extractionError}</span>
        </div>
      )}
    </div>
  )
}
