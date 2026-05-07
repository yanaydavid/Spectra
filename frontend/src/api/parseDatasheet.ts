import axios from 'axios'
import type { ExtractedParams } from '../types'

export interface ParseError {
  status: number
  message: string
}

export async function parseDatasheet(file: File): Promise<ExtractedParams> {
  const form = new FormData()
  form.append('file', file)

  try {
    const { data } = await axios.post<ExtractedParams>('/api/parse-datasheet', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    })
    return data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 0
      const detail = err.response?.data?.detail ?? err.message
      const error: ParseError = { status, message: detail }
      throw error
    }
    throw { status: 0, message: 'Unknown error' } as ParseError
  }
}
