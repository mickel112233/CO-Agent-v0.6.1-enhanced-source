export function recoverInterruptedWorkflow(workflow) {
  if (!workflow || !Array.isArray(workflow.pipeline)) {
    return { workflow, interruptedIds: [], message: '' };
  }
  const interruptedIds = [];
  const pipeline = workflow.pipeline.map(step => {
    if (!step || step.status !== 'running') return step;
    if (typeof step.id === 'string' && step.id) interruptedIds.push(step.id);
    return {
      ...step,
      status: 'blocked',
      result: 'This step was interrupted when CO-Agent closed. Review its inputs and rerun it manually; interrupted work is never replayed automatically.'
    };
  });
  if (!interruptedIds.length) return { workflow, interruptedIds, message: '' };
  return {
    workflow: { ...workflow, pipeline },
    interruptedIds,
    message: interruptedIds.length === 1
      ? 'Recovered one interrupted agent step. It is blocked until you review it and choose to rerun it; no work was replayed automatically.'
      : 'Recovered ' + interruptedIds.length + ' interrupted agent steps. They are blocked until you review and rerun them; no work was replayed automatically.'
  };
}
