import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AppSettings,
  AppSettingsUpdate,
  CreateFolderResult,
  CreateHtmlResult,
  DeleteFileResult,
  DuplicateFileResult,
  AtelierApi,
  ImportFilesResult,
  UpdateMetadataResult,
  InitialAppState,
  MoveFileResult,
  OpenVaultResult,
  SaveFileResult,
  VaultIndex,
} from '../src/shared/types.js'

const api: AtelierApi = {
  getInitialState: () => ipcRenderer.invoke('app:get-initial-state') as Promise<InitialAppState>,
  openFolder: () => ipcRenderer.invoke('vault:open-folder') as Promise<OpenVaultResult | null>,
  openPath: (rootPath: string) => ipcRenderer.invoke('vault:open-path', rootPath) as Promise<OpenVaultResult>,
  createDemoCopy: () => ipcRenderer.invoke('vault:create-demo-copy') as Promise<OpenVaultResult>,
  pickDirectory: (options?: { title?: string; defaultPath?: string }) =>
    ipcRenderer.invoke('vault:pick-directory', options) as Promise<string | null>,
  createVaultAt: (parentDir: string, vaultName: string) =>
    ipcRenderer.invoke('vault:create-at', parentDir, vaultName) as Promise<OpenVaultResult>,
  closeVault: () => ipcRenderer.invoke('vault:close') as Promise<void>,
  getVaultConfig: () =>
    ipcRenderer.invoke('vault:get-config') as Promise<{
      config: { vaultName?: string; defaultTemplate?: string; ignoredPaths?: string[] }
      templates: Array<{ name: string; format: 'html' | 'md' }>
    }>,
  saveVaultConfig: (config: { vaultName?: string; defaultTemplate?: string; ignoredPaths?: string[] }) =>
    ipcRenderer.invoke('vault:save-config', config) as Promise<VaultIndex>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  updateSettings: (update: AppSettingsUpdate) =>
    ipcRenderer.invoke('settings:update', update) as Promise<AppSettings>,
  readFile: (relativePath: string) => ipcRenderer.invoke('vault:read-file', relativePath) as Promise<string>,
  saveFile: (relativePath: string, content: string) =>
    ipcRenderer.invoke('vault:save-file', relativePath, content) as Promise<SaveFileResult>,
  createHtml: (title?: string) => ipcRenderer.invoke('vault:create-html', title) as Promise<CreateHtmlResult>,
  createMarkdown: (title?: string) =>
    ipcRenderer.invoke('vault:create-markdown', title) as Promise<CreateHtmlResult>,
  createFolder: (folderPath: string) =>
    ipcRenderer.invoke('vault:create-folder', folderPath) as Promise<CreateFolderResult>,
  renameFile: (fromPath: string, newName: string) =>
    ipcRenderer.invoke('vault:rename-file', fromPath, newName) as Promise<MoveFileResult>,
  moveFile: (fromPath: string, toPath: string) =>
    ipcRenderer.invoke('vault:move-file', fromPath, toPath) as Promise<MoveFileResult>,
  duplicateFile: (relativePath: string) =>
    ipcRenderer.invoke('vault:duplicate-file', relativePath) as Promise<DuplicateFileResult>,
  deleteFile: (relativePath: string) =>
    ipcRenderer.invoke('vault:delete-file', relativePath) as Promise<DeleteFileResult>,
  updateMetadata: (relativePath: string, updates: { description?: string; tags?: string[] }) =>
    ipcRenderer.invoke('vault:update-metadata', relativePath, updates) as Promise<UpdateMetadataResult>,
  revealInExplorer: (relativePath: string) =>
    ipcRenderer.invoke('vault:reveal-in-explorer', relativePath) as Promise<void>,
  openInBrowser: (relativePath: string) =>
    ipcRenderer.invoke('vault:open-in-browser', relativePath) as Promise<void>,
  importFiles: (sourcePaths: string[], targetDirectory?: string) =>
    ipcRenderer.invoke('vault:import-files', sourcePaths, targetDirectory) as Promise<ImportFilesResult>,
  getDroppedFilePaths: (files: File[]) =>
    files.map((file) => webUtils.getPathForFile(file)).filter((value): value is string => Boolean(value)),
  setPreviewContent: (relativePath: string, content: string) =>
    ipcRenderer.invoke('preview:set-content', relativePath, content) as Promise<string>,
  getPreviewUrl: (relativePath: string) => ipcRenderer.invoke('preview:get-url', relativePath) as Promise<string>,
  openExternal: (href: string) => ipcRenderer.invoke('shell:open-external', href) as Promise<void>,
  onIndexUpdated: (listener: (index: VaultIndex) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, index: VaultIndex) => listener(index)
    ipcRenderer.on('vault:index-updated', handler)
    return () => ipcRenderer.removeListener('vault:index-updated', handler)
  },
}

contextBridge.exposeInMainWorld('atelier', api)
