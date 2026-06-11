export { getAuthClient, getCurrentSession, getCurrentUser } from './auth'
export { ensureBackendSession, getBackendUserId } from './session'
export { migrateLocalDataToBackend } from './localMigration'
export {
  archiveItem,
  createCapsule,
  deleteAccountData,
  deleteAudio,
  deleteCapsule,
  getAudioPlaybackUrl,
  getListenCounts,
  getProfile,
  isCapsuleUnlocked,
  listActivity,
  listArchive,
  listAudioLibrary,
  listCapsules,
  listSavedSignals,
  listUserRelics,
  logActivity,
  openCapsule,
  recordReplay,
  renameAudio,
  saveSignal,
  setAudioArchived,
  setAudioVisibility,
  setRelicFavorite,
  syncProfile,
  toggleListen,
  unarchiveItem,
  unlockUserRelic,
  unsaveSignal,
  updateBio,
  updateProfileFlags,
  uploadAudio,
} from './library'
export type {
  ActivityEventType,
  ArchiveItemType,
  AudioFileRow,
  CapsuleRow,
  ProfileRow,
  SavedSignalRow,
  UserRelicRow,
} from './library'
export { fromTable, getDatabaseClient } from './database'
export { getStorageBucket, getStorageClient, createSignedAudioUrl } from './storage'
export { getOptionalSupabaseClient, getSupabaseClient } from './supabase'
export { isSupabaseConfigured, supabaseEnv } from './supabase-env'
export type { Database, Json } from './database.types'
export type { EcosphereStorageBucket } from './storage'
