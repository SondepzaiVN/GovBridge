import type { AssistantTool } from '../assistant.types.js';
import { FallbackTool } from './fallback.tool.js';
import { FormFillTool } from './form-fill.tool.js';
import { NavigationTool } from './navigation.tool.js';
import { NextStepTool } from './next-step.tool.js';
import { ServiceInfoTool } from './service-info.tool.js';

export const buildAssistantTools = (): AssistantTool[] => [
  new NextStepTool(),
  new FormFillTool(),
  new ServiceInfoTool(),
  new NavigationTool(),
  new FallbackTool(),
];
