# Workspace Refactor: Layout, Theme, Responsive Modals & Context Menus

## Four sections, pact of decisions:

### 1. Theme System — 60-30-10 Refactor (src/theme.ts)
- Replace all three themes (Dark/OLED/Light) with the Claude-inspired palette per user spec. New values:
  - Dark: bg `#212123`, surface `#2A2A2D`, sidebarBg `#171719`, border `#36363B`, text `#ECECF1`, textMuted `#8E8E93`, accent `#B497FF`, pillBg `#36363B`
  - OLED: bg `#000000`, surface `#121214`, sidebarBg `#0A0A0C`, border `#1F1F22`, accent `#B497FF`
  - Light: bg `#FFFFFF`, surface `#F8F8FA`, sidebarBg `#F4F4F6`, border `#E4E4E7`, text `#18181B`, accent `#8B5CF6`
- All other tokens (accentText, pillBg) remap accordingly.
- Schema stays clean: 9 tokens in the `Theme` interface. No new tokens needed.

### 2. Folder-Item Relationship (structurally NEW)
- **DB schema**: Add `folder_id TEXT NOT NULL DEFAULT 'main'` column to `NoteRow` in `schema.ts`.
- **Note interface**: Add `folderId: string` to `Note` (in NoteRepository.ts). Default `'main'`.
- **NewNoteInput**: Add `folderId?: string`.
- **NoteRepository**: Persist `folder_id` on create/update. `getAllNotes` accepts optional folderId filter.
- **NoteStore**: Add `selectedFolderId: string | null` to state (defaults `'main'`).
- **useNoteStore actions**: `createNote` passes `folderId` from `selectedFolderId` or the `NewNoteInput.folderId` override.
- **Schema migration**: `ALTER TABLE notes ADD COLUMN folder_id TEXT NOT NULL DEFAULT 'main'` in schema.sql.

### 3. Persist Folder Tree to Database (was in-memory useFolderTree → store-backed)
- New `folders` table in schema: `id TEXT PRIMARY KEY, uuid TEXT, label TEXT, parent_id TEXT, is_deleted INTEGER DEFAULT 0`.
- New `FolderRow` in DB maps 1:1.
- New folder CRUD in a store — since folders persist, `useFolderTree` becomes a thin in-memory sync over the store.
- Decisions synthesized earlier: `selectedFolderId` lives in `useNoteStore`; folder tree persists.

### 4. Context Menu Wiring — Sidebar Folder Rows (Already Done)
- Already supports: New Note, New Sub-folder, Rename, Move to…, Duplicate, Delete.
- Wire "New Note" to `useNoteStore.createNote(folderId=targetFolderId)`.
- Wire "Move to…" to persist folder parentId change via `useNoteStore.moveFolder`.
- Wire "Delete" to `useNoteStore.softDeleteFolder`.
- Wire "Duplicate" via store's `duplicateFolder`.

### 5. Context Menu Wiring — NotesView Note Rows (NEW, per user answer)
- Add right-click (web) + long-press (native) trigger on each note row in NotesView list pane.
- Actions: Move to [folder], Duplicate, Delete (no New Note/Rename for notes).
- "Move to" opens the MoveToModal with the note's target folderId update.
- "Delete" → `useNoteStore.softDeleteNote(noteId)`.
- "Duplicate" → `useNoteStore.duplicateNote(noteId)`.
- NotesView needs a new `onOpenContextMenu` callback threaded from HomeScreen.

### 6. Responsive Move Modal (One centered card at all sizes)
- Replace rigid `maxWidth: 540, maxHeight: 680` with fluid sizing from `useWindowDimensions`:
  - `width: '90%'`, `maxWidth: 540`, `height: '80%'`, `maxHeight: 680`, `borderRadius: 16`
  - On all viewports the same centered card pattern.
  - Content inside scrollable (`ScrollView`).
- Upgrade to work for BOTH folders AND notes (pull folder tree from store, and list notes as grouping target).
- Move flow: target folder selection → `useNoteStore.moveFolder` or `useNoteStore.moveNote`.
- Material: `onConfirm(targetId)` in HomeScreen → selectedFolderId update + tree refresh.

### 7. UseNoteStore SelectedFolderId wiring
- `selectedFolderId` in state drives:
  - `createNote`: uses `selectedFolderId` as default folderId.
  - `getAllNotes`: filters by folderId when selected.
  - NotesView: passes folderId filter.
- Context menu on folder rows: pass `targetFolderId` = `menuAnchor.node.id` to createNote/move/spawn.

### 8. Files Touched (reestimate):
- `src/theme.ts`: theme object rewrites.
- `src/db/schema.ts`: add folder_id column + folders table.
- `src/db/NoteRepository.ts`: add folderId to Note interface + NewNoteInput + repo methods.
- `src/db/NoteRepository.ts`: add folder CRUD methods.
- `src/db/FolderRepository.ts` (NEW): folder tree persistence DB layer.
- `src/store/useNoteStore.ts`: add selectedFolderId, moveFolder, moveNote, duplicateNote, getNotesByFolder.
- `src/screens/HomeScreen.tsx`: pass selectedFolderId, wire context menu to store.
- `src/components/Sidebar.tsx`: folder context menu wired to store callbacks.
- `src/components/notes/NotesView.tsx`: add note-level context menu (right-click + long-press).
- `src/components/shared/MoveToModal.tsx`: make fluid (90%/80% responsive), support both folder and note targets.
- `src/components/shared/ContextMenu.tsx`: no structural change.

## Known Deferred (non-blocking):
- Sidebar note list re-filtering when selectedFolderId changes.
- Folder tree full CRUD in `FolderRepository.ts`.
- NotesView row context-menu integration in full scope.