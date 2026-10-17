import { readFile, writeFile } from 'node:fs/promises';

// #858 synthetic diagnostic only: patch a disposable CI checkout before building.
// NEVER commit the modified src files or use this build for Preview/Production.
async function patchFile(path, from, to) {
  const input = await readFile(path, 'utf8');
  const count = input.split(from).length - 1;
  if (count !== 1) throw new Error('Instrumentation expected one match in ' + path + ', found ' + count);
  await writeFile(path, input.replace(from, to));
}
const dragPath = 'src/components/home/views/DraggableTaskItem.tsx';
const surfacePath = 'src/components/home/views/TaskReorderSurfaces.tsx';
await patchFile(dragPath, "import { useDraggable } from '@dnd-kit/react';", "import { useDraggable as useRealDraggable } from '@dnd-kit/react';\ntype AuditWindow = Window & { __mosaic858Variant?: string; __mosaic858DndCounts?: Record<string, number> };\nconst useDraggable = (options: Parameters<typeof useRealDraggable>[0]) => {\n  const w = window as AuditWindow;\n  const suppressed = w.__mosaic858Variant?.includes('no-dnd') ?? false;\n  if (w.__mosaic858DndCounts) w.__mosaic858DndCounts[suppressed ? 'skippedDrag' : 'realDrag']++;\n  if (suppressed) return { ref: (_node: HTMLDivElement | null) => {}, handleRef: (_node: HTMLElement | null) => {} };\n  return useRealDraggable(options);\n};");
await patchFile(surfacePath, "import { useDroppable } from '@dnd-kit/react';", "import { useDroppable as useRealDroppable } from '@dnd-kit/react';\ntype AuditWindow = Window & { __mosaic858Variant?: string; __mosaic858DndCounts?: Record<string, number> };\nconst useDroppable = (options: Parameters<typeof useRealDroppable>[0]) => {\n  const w = window as AuditWindow;\n  const suppressed = w.__mosaic858Variant?.includes('no-dnd') ?? false;\n  if (w.__mosaic858DndCounts) w.__mosaic858DndCounts[suppressed ? 'skippedDrop' : 'realDrop']++;\n  if (suppressed) return { ref: (_node: HTMLDivElement | null) => {} };\n  return useRealDroppable(options);\n};");
await patchFile(surfacePath, "layout={animatePosition ? 'position' : false}",
  "layout={(window as AuditWindow).__mosaic858Variant?.includes('no-motion') ? false : animatePosition ? 'position' : false}");
console.log('Synthetic #858 build-time drag/drop and Motion ablation installed.');
