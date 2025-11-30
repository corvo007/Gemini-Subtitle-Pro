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
- [x] **Step 1: Create Service Directory Structure**
- [x] **Step 2: Extract Logger Utility**
- [x] **Step 3: Extract Concurrency Utility**
- [x] **Step 4: Extract Time Utilities**
- [x] **Step 5: Extract Audio Decoder**
- [x] **Step 6: Extract Audio Converter**
- [x] **Step 7: Move Audio Segmenter**
- [x] **Step 8: Extract Subtitle Parser**
- [x] **Step 9: Extract Subtitle Generator**
- [x] **Step 10: Extract API Services** (Gemini, OpenAI, Batch, Glossary)

## Phase 4: Component & Hook Refactoring
- [x] **Phase 4.1: Extract Custom Hooks**
    - [x] `useSettings`
    - [x] `useToast`
    - [x] `useSnapshots`
    - [x] `useGlossaryFlow`
- [x] **Phase 4.2: Extract Page Components**
    - [x] `LogViewerModal`
    - [x] `HomePage`
    - [x] `WorkspacePage`
- [x] **Phase 4.3: Integrate & Simplify App.tsx**
    - [x] Integrate hooks
    - [x] Integrate page components
    - [x] Remove unused code and imports

## Phase 5: Final Cleanup
- [ ] Final verification of all features
- [ ] Documentation update
