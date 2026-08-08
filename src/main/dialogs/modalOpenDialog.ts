import {
  BrowserWindow,
  dialog,
  type OpenDialogOptions,
  type OpenDialogReturnValue,
  type WebContents
} from 'electron'

const activeDialogKeys = new Set<string>()

function getDialogKey(owner: BrowserWindow | null, dialogName: string): string {
  return `${owner?.id ?? 'app'}:${dialogName}`
}

export async function showModalOpenDialog(
  sender: WebContents | null | undefined,
  dialogName: string,
  options: OpenDialogOptions
): Promise<OpenDialogReturnValue> {
  const owner = sender && !sender.isDestroyed() ? BrowserWindow.fromWebContents(sender) : null
  const dialogKey = getDialogKey(owner, dialogName)

  if (activeDialogKeys.has(dialogKey)) {
    owner?.focus()

    return {
      canceled: true,
      filePaths: []
    }
  }

  activeDialogKeys.add(dialogKey)

  try {
    if (owner && !owner.isDestroyed()) {
      return await dialog.showOpenDialog(owner, options)
    }

    return await dialog.showOpenDialog(options)
  } finally {
    activeDialogKeys.delete(dialogKey)
  }
}
