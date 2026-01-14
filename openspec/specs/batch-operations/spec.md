# batch-operations Specification

## Purpose

TBD - created by archiving change replace-fix-timestamps-with-regenerate. Update Purpose after archive.

## Requirements

### Requirement: Regenerate Selected Batches

The system SHALL provide a "Regenerate" batch operation that re-runs the full subtitle generation pipeline for selected batches.

#### Scenario: User regenerates selected batches

- **WHEN** user selects one or more batches and clicks "Regenerate"
- **THEN** the system SHALL display a modal with optional transcription and translation hints
- **AND** upon confirmation, run the full pipeline (Transcription → Refinement → Alignment → Translation)
- **AND** replace the original subtitles with the regenerated ones

#### Scenario: Auto-chunking for large selections

- **WHEN** the selected time range exceeds the configured chunk duration
- **THEN** the system SHALL automatically split the range into multiple chunks
- **AND** process them in parallel using the configured concurrency settings

#### Scenario: User provides custom hints

- **WHEN** user provides transcription or translation hints in the modal
- **THEN** the system SHALL inject these hints into the respective pipeline prompts
- **AND** apply them during refinement and translation steps

#### Scenario: Operation cancellation

- **WHEN** user cancels the regeneration mid-process
- **THEN** the system SHALL restore the original subtitles from the auto-created snapshot
- **AND** display a notification indicating the operation was cancelled

### Requirement: Reuse Existing Context

The regenerate operation SHALL reuse existing Glossary and SpeakerProfile data without re-extraction.

#### Scenario: Using existing glossary

- **WHEN** regenerating batches with an active glossary
- **THEN** the system SHALL apply the glossary terms during refinement and translation
- **AND** NOT trigger a new glossary extraction

#### Scenario: Using existing speaker profiles

- **WHEN** regenerating batches with speaker diarization enabled
- **THEN** the system SHALL use existing speaker profiles for speaker identification
- **AND** NOT trigger new speaker profile extraction
