---
name: blender-automation
description: Plan and automate Blender modeling, materials, lighting, animation, rendering, and export.
---

# Blender creation and automation skill

## Inspect first
- Identify the installed Blender version, current file, scene, render engine, units, frame range, and output paths.
- Preserve the original .blend file. Prefer a new versioned copy before broad scripted edits.
- Name collections, objects, materials, cameras, and lights consistently.

## Workflow
1. Translate the brief into reference dimensions, geometry, materials, lighting, camera, and output requirements.
2. Prefer non-destructive modifiers and reusable materials.
3. For Python automation, use a short script with explicit preconditions, version checks, bounded operations, and useful errors.
4. Save a checkpoint before rendering or destructive scene changes.
5. Verify output files, dimensions, frame count, and render logs before reporting completion.

## Safety and quality
- Do not run untrusted .blend scripts automatically.
- Ask before overwriting project files, installing add-ons, or using network assets.
- If Blender is unavailable, provide scripts/instructions but do not claim they were executed.
