# NexMP

NexMP is a local-first desktop media library and player for Windows. It is built for organizing anime, series, movies, and personal video folders into profile-based libraries with a fast Electron + React interface.

## Highlights

- Profile-based libraries with persistent login.
- Collection manager with single-folder and multi-folder sources.
- Dynamic folders that rescan automatically and place new files into Pending.
- Manual folders for hand-picked video lists.
- HTML player as the default engine.
- MPV player available as a beta fallback.
- MKV soft subtitle extraction for the HTML player.
- Collection thumbnail picker with image upload, video-frame capture, WebP compression, and a 1 MB compressed-size limit.
- Continue watching and playback progress per profile.
- Global home sort, player engine, and zoom state.

## Library Flow

NexMP separates media into profiles. A profile owns its collections, tags, playback progress, and continue-watching rows.

Collections can use:

- Dynamic sources: NexMP follows the folder and rescans it. New videos appear in Pending first.
- Manual sources: NexMP stores only selected files. Switching from Dynamic to Manual is irreversible.

When a dynamic scan finds new videos, NexMP shows a toast, a Pending badge, and an inline review banner so the user can approve or reject the new items.

## Player Engines

NexMP ships with two playback engines:

- HTML engine: default player, used for normal playback and cleaned MKV soft subtitles.
- MPV engine: beta fallback for videos that need native mpv behavior.

The player engine setting is global, so it applies to every profile.

## Development

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run dev
```

Run type checks:

```bash
npm run typecheck
```

Run lint:

```bash
npm run lint
```

Build Windows installer:

```bash
npm run build:win
```

Build unpacked Windows app:

```bash
npm run build:unpack
```

## Versioning

NexMP uses semantic versioning:

- Major: breaking data model or app behavior changes.
- Minor: new user-facing features.
- Patch: bugfixes and small refinements.

Current recommended next release: `2.1.0`.

## Changelog

### 2.1.0

Added:

- Edit profile directly from the opening profile picker.
- Delete active library/profile from Settings.
- GitHub-style delete confirmation requiring `DELETE {library_name}`.
- Delete summary showing affected collection and video counts.
- Dynamic scan toast with a Review action.
- Pending review banner for newly detected dynamic-folder videos.
- Pending badges on tabs, collection cards, and source cards.

Changed:

- Dynamic scan discoveries are now more noticeable without using disruptive modal dialogs.
- Settings now includes a Danger zone for destructive profile actions.

### 2.0.0

Added:

- Global state for home sort order, player engine, and home zoom level.
- Persistent login state so the app can reopen directly into the last active profile.
- MPV player engine as a beta option.
- HTML engine as the default player.
- Settings page player-engine control.
- Splash screen on app launch.
- Collection thumbnail picker.
- Image upload and drag-drop for collection thumbnails.
- Video-frame capture for collection thumbnails.
- Internal WebP conversion/compression for thumbnails.
- 1 MB compressed-size validation for thumbnails.
- Single-folder collection settings.
- Manual and dynamic source management.
- Pending approval/rejection flow for dynamic folders.

Changed:

- Dynamic/manual source state is shown only where it belongs: source-level UI, not multi-folder collection-level metadata.
- Sidebar collapse trigger moved to double-clicking navigation items.
- Sidebar animation was removed for a cleaner visual transition.
- NexMP logo is used in the sidebar.
- Version updated to `2.0.0`.

Fixed:

- Collection thumbnails now persist to local app storage and reappear on Home/Edit.
- Selected images from Explorer now load correctly in the thumbnail picker.
- Soft subtitles in the HTML player no longer move when controls appear.
- Soft subtitles render in a separate layer from player controls.
- MKV ASS/SSA subtitles are converted more safely into plain text for the HTML player.
- ASS event parsing skips style/effect-heavy lines such as Signs, OP/ED, drawing, and karaoke layers.
- Subtitle text avoids black background boxes behind captions.

### 1.x

Archived:

- The v1 installer is preserved under `release/v1/` for future audit/reference.
- The local `v1` git tag points to the preserved v1 release commit.
