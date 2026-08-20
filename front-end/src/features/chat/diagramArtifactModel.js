const DIAGRAM_SKILL_NAMES = new Set(['react-flow-diagram', 'react_flow_diagram']);
const COMPLETE_DIAGRAM_BLOCK = /```diagram-flow[^\n]*\n[\s\S]*?```/i;
const OPEN_DIAGRAM_BLOCK = /```diagram-flow(?:\s|\n|$)/i;
const UUID_PATTERN =
  /^[{]?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[}]?$/i;
const INTERNAL_PATH_PATTERN = /^(?:u|user|users|artifact|diagram)[/:_-][a-z0-9/_-]+$/i;

const hasDiagramSkill = (items) =>
  (Array.isArray(items) ? items : []).some((item) => {
    if (item?.type === 'skill') {
      return (Array.isArray(item.skills) ? item.skills : []).some((skill) =>
        DIAGRAM_SKILL_NAMES.has(String(skill || '').toLowerCase()),
      );
    }
    if (item?.type !== 'tool' || !['read_skill', 'load_skill'].includes(item.name)) return false;
    const skillName =
      item.args?.skill_name ||
      item.args?.skillName ||
      item.result?.skill_name ||
      item.result?.skillName;
    return DIAGRAM_SKILL_NAMES.has(String(skillName || '').toLowerCase());
  });

export function getDiagramArtifactPhase({
  isActive = false,
  markdown = '',
  steps = [],
  timeline = [],
} = {}) {
  const content = String(markdown || '');
  if (COMPLETE_DIAGRAM_BLOCK.test(content)) return 'ready';
  if (!isActive) return 'hidden';
  if (OPEN_DIAGRAM_BLOCK.test(content) || hasDiagramSkill(steps) || hasDiagramSkill(timeline)) {
    return 'generating';
  }
  return 'hidden';
}

function getDiagramArtifactTitle(title) {
  const normalized = typeof title === 'string' ? title.trim() : '';
  if (
    !normalized ||
    normalized.toLowerCase() === 'diagram' ||
    UUID_PATTERN.test(normalized) ||
    INTERNAL_PATH_PATTERN.test(normalized)
  ) {
    return 'Diagram ready';
  }
  return normalized.slice(0, 80);
}

export function getDiagramArtifactCardPresentation({ isGenerating = false, title = '' } = {}) {
  if (isGenerating) {
    return {
      title: 'Building diagram',
      metadata: 'Diagram · Structuring nodes and relationships',
      isInteractive: false,
    };
  }

  return {
    title: getDiagramArtifactTitle(title),
    metadata: 'Interactive diagram',
    isInteractive: true,
  };
}
