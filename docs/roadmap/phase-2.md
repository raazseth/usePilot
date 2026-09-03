# usePilot — Phase 2 Roadmap

## Overview
Phase 2 builds upon the Phase 1 foundation by adding multimodal understanding, file attachments, and local context extraction.

## Planned Capabilities
1. **Multimodal Attachments**:
   - Image drag-and-drop into chat input.
   - Text file / PDF document ingestion.
   - Schema already future-proofed with `attachments` column in `messages` table.
2. **Context Window Management**:
   - Token budgeting and dynamic truncation of past conversation turns.
3. **Enhanced Provider Features**:
   - Model parameter tuning (top_p, presence_penalty, frequency_penalty).
   - Vision-capable local model detection (e.g. LLaVA, MiniCPM-V, Qwen-VL).
