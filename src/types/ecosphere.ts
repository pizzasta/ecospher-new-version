export interface SignalNode {
  id: string
  name: string
  domain: string
  x: number
  y: number
  strength: number
  latency: number
  status: 'active' | 'inactive' | 'warning'
  description: string
}

export interface EcosystemData {
  totalSignals: number
  activeNodes: number
  systemHealth: number
  lastUpdate: string
}

export type ViewMode = 'overview' | 'flow' | 'stability'
