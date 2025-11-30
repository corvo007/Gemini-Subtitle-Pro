# Refactoring Plan

## Phase 1: Directory Structure Reorganization
- [x] Create `src` directory
- [x] Create subdirectories (`components`, `services`, `hooks`, `utils`, `types`, `constants`, `workers`, `styles`)
- [x] Configure path aliases in `tsconfig.json` and `vite.config.ts`
- [x] Move files to `src` and subdirectories
- [x] Update import paths
- [x] Verify build

## Phase 2: Type System Refactoring
- [x] Create `src/types/` directory
- [x] Create modular type files (`subtitle.ts`, `glossary.ts`, `api.ts`, `settings.ts`, `index.ts`)
- [x] Update imports in `src/App.tsx`
- [x] Update imports in other files (`gemini.ts`, `utils.ts`, etc.)
- [x] Verify build
- [x] Delete `src/types.ts`

## Phase 3: Service Layer Extraction
- [ ] Create `src/services/` files:
    - [ ] `gemini.ts` (API interaction)
    - [ ] `storage.ts` (Local storage)
    - [ ] `audio.ts` (Audio processing)
    - [ ] `subtitle.ts` (Subtitle parsing/formatting)
- [ ] Refactor `src/gemini.ts` into services
- [ ] Refactor `src/utils.ts` into services/utils
- [ ] Update consumers to use new services

## Phase 4: Component Extraction
- [ ] Extract components from `App.tsx`:
    - [ ] `Header.tsx`
    - [ ] `Footer.tsx`
    - [ ] `FileUploader.tsx`
    - [ ] `SubtitleEditor.tsx`
    - [ ] `SettingsPanel.tsx`
    - [ ] `ProgressOverlay.tsx`
- [ ] Move `GlossaryManager.tsx` to `src/components/`
- [ ] Update imports

## Phase 5: Custom Hooks
- [ ] Extract logic into hooks:
    - [ ] `useSubtitle.ts`
    - [ ] `useAudio.ts`
    - [ ] `useGlossary.ts`
    - [ ] `useSettings.ts`

## Phase 6: Cleanup and Final Verification
- [ ] Remove unused files
- [ ] Final build check
- [ ] Run all tests (manual)
