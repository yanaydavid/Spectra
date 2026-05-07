import axios from 'axios'
import type { CascadeResult, ChainCalculationRequest } from '../types'

export interface CalcError {
  status: number
  message: string
}

export async function calculateChain(
  request: ChainCalculationRequest,
): Promise<CascadeResult> {
  try {
    const { data } = await axios.post<CascadeResult>('/api/calculate-chain', request, {
      timeout: 10_000,
    })
    return data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 0
      const detail = err.response?.data?.detail ?? err.message
      const error: CalcError = { status, message: detail }
      throw error
    }
    throw { status: 0, message: 'Unknown error' } as CalcError
  }
}
