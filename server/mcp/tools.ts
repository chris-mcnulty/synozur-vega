import { z } from 'zod';
import { storage } from '../storage';
import type { McpAuthContext } from './auth';
import { hasScope } from './auth';
import { MCP_SCOPES } from '@shared/schema';

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function success(data: unknown): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function error(message: string): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export const mcpTools = {
  get_okrs: {
    description: 'Get all OKRs (Objectives and Key Results) for the organization. Can filter by quarter and year.',
    inputSchema: z.object({
      quarter: z.number().min(1).max(4).optional().describe('Filter by quarter (1-4)'),
      year: z.number().optional().describe('Filter by year'),
    }),
    requiredScope: MCP_SCOPES.READ_OKRS,
    execute: async (params: { quarter?: number; year?: number }, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_OKRS)) {
        return error('Permission denied: read:okrs scope required');
      }
      
      const objectives = await storage.getObjectivesByTenantId(
        context.tenant.id, 
        params.quarter, 
        params.year
      );

      const objectivesWithKRs = await Promise.all(
        objectives.map(async (obj) => {
          const keyResults = await storage.getKeyResultsByObjectiveId(obj.id);
          return {
            ...obj,
            keyResults,
          };
        })
      );

      return success({
        count: objectivesWithKRs.length,
        objectives: objectivesWithKRs,
      });
    },
  },

  get_big_rocks: {
    description: 'Get all Big Rocks (major initiatives) for the organization. Can filter by quarter and year.',
    inputSchema: z.object({
      quarter: z.number().min(0).max(4).optional().describe('Filter by quarter (0=annual, 1-4=quarterly)'),
      year: z.number().optional().describe('Filter by year'),
    }),
    requiredScope: MCP_SCOPES.READ_BIG_ROCKS,
    execute: async (params: { quarter?: number; year?: number }, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_BIG_ROCKS)) {
        return error('Permission denied: read:big_rocks scope required');
      }

      const bigRocks = await storage.getBigRocksByTenantId(
        context.tenant.id,
        params.quarter,
        params.year
      );

      return success({
        count: bigRocks.length,
        bigRocks,
      });
    },
  },

  get_strategies: {
    description: 'Get all strategies for the organization.',
    inputSchema: z.object({}),
    requiredScope: MCP_SCOPES.READ_STRATEGIES,
    execute: async (_params: Record<string, never>, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_STRATEGIES)) {
        return error('Permission denied: read:strategies scope required');
      }

      const strategies = await storage.getStrategiesByTenantId(context.tenant.id);

      return success({
        count: strategies.length,
        strategies,
      });
    },
  },

  get_mission: {
    description: 'Get the organization mission statement.',
    inputSchema: z.object({}),
    requiredScope: MCP_SCOPES.READ_FOUNDATIONS,
    execute: async (_params: Record<string, never>, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_FOUNDATIONS)) {
        return error('Permission denied: read:foundations scope required');
      }

      const foundation = await storage.getFoundationByTenantId(context.tenant.id);

      return success({
        mission: foundation?.mission || null,
      });
    },
  },

  get_vision: {
    description: 'Get the organization vision statement.',
    inputSchema: z.object({}),
    requiredScope: MCP_SCOPES.READ_FOUNDATIONS,
    execute: async (_params: Record<string, never>, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_FOUNDATIONS)) {
        return error('Permission denied: read:foundations scope required');
      }

      const foundation = await storage.getFoundationByTenantId(context.tenant.id);

      return success({
        vision: foundation?.vision || null,
      });
    },
  },

  get_values: {
    description: 'Get the organization core values.',
    inputSchema: z.object({}),
    requiredScope: MCP_SCOPES.READ_FOUNDATIONS,
    execute: async (_params: Record<string, never>, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_FOUNDATIONS)) {
        return error('Permission denied: read:foundations scope required');
      }

      const foundation = await storage.getFoundationByTenantId(context.tenant.id);

      return success({
        values: foundation?.values || [],
      });
    },
  },

  get_annual_goals: {
    description: 'Get the organization annual goals.',
    inputSchema: z.object({
      year: z.number().optional().describe('Filter by year'),
    }),
    requiredScope: MCP_SCOPES.READ_FOUNDATIONS,
    execute: async (params: { year?: number }, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_FOUNDATIONS)) {
        return error('Permission denied: read:foundations scope required');
      }

      const foundation = await storage.getFoundationByTenantId(context.tenant.id);
      let goals = (foundation?.annualGoals as Array<{ year?: number }>) || [];

      if (params.year) {
        goals = goals.filter((g) => g.year === params.year);
      }

      return success({
        count: goals.length,
        annualGoals: goals,
      });
    },
  },

  get_teams: {
    description: 'Get all teams in the organization.',
    inputSchema: z.object({}),
    requiredScope: MCP_SCOPES.READ_TEAMS,
    execute: async (_params: Record<string, never>, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_TEAMS)) {
        return error('Permission denied: read:teams scope required');
      }

      const teams = await storage.getTeamsByTenantId(context.tenant.id);

      return success({
        count: teams.length,
        teams,
      });
    },
  },

  get_meetings: {
    description: 'Get Focus Rhythm meetings for the organization. Can filter by date range.',
    inputSchema: z.object({
      startDate: z.string().optional().describe('Start date in ISO format'),
      endDate: z.string().optional().describe('End date in ISO format'),
    }),
    requiredScope: MCP_SCOPES.READ_MEETINGS,
    execute: async (params: { startDate?: string; endDate?: string }, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.READ_MEETINGS)) {
        return error('Permission denied: read:meetings scope required');
      }

      let meetings = await storage.getMeetingsByTenantId(context.tenant.id);

      if (params.startDate) {
        const start = new Date(params.startDate);
        meetings = meetings.filter((m) => new Date(m.date!) >= start);
      }

      if (params.endDate) {
        const end = new Date(params.endDate);
        meetings = meetings.filter((m) => new Date(m.date!) <= end);
      }

      return success({
        count: meetings.length,
        meetings,
      });
    },
  },

  // ============================================
  // WRITE TOOLS - Phase 2
  // ============================================

  update_kr_progress: {
    description: 'Update the current value of a Key Result. Progress is automatically recalculated based on the metric type.',
    inputSchema: z.object({
      keyResultId: z.string().describe('The ID of the Key Result to update'),
      currentValue: z.number().describe('The new current value for the Key Result'),
      status: z.enum(['not_started', 'on_track', 'behind', 'at_risk', 'completed']).optional().describe('Optional status override'),
    }),
    requiredScope: MCP_SCOPES.WRITE_OKRS,
    execute: async (params: { keyResultId: string; currentValue: number; status?: string }, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.WRITE_OKRS)) {
        return error('Permission denied: write:okrs scope required');
      }

      // Get the key result to verify tenant ownership
      const keyResult = await storage.getKeyResultById(params.keyResultId);
      if (!keyResult) {
        return error('Key Result not found');
      }

      // Verify tenant ownership
      if (keyResult.tenantId !== context.tenant.id) {
        return error('Permission denied: Key Result belongs to a different organization');
      }

      // Calculate progress based on metric type
      let progress = 0;
      const target = keyResult.targetValue ?? 0;
      const initial = keyResult.initialValue ?? 0;
      const current = params.currentValue;

      if (keyResult.metricType === 'complete') {
        // Binary: 0% or 100%
        progress = current >= target ? 100 : 0;
      } else if (keyResult.metricType === 'maintain') {
        // Within threshold = 100%
        progress = Math.abs(current - target) <= Math.abs(initial - target) ? 100 : 50;
      } else {
        // increase or decrease
        const range = Math.abs(target - initial);
        if (range > 0) {
          const achieved = keyResult.metricType === 'decrease' 
            ? initial - current 
            : current - initial;
          progress = Math.min(100, Math.max(0, (achieved / range) * 100));
        }
      }

      // Build update data
      const updateData: Record<string, any> = {
        currentValue: params.currentValue,
        progress: progress,
      };

      if (params.status) {
        updateData.status = params.status;
      }

      const updated = await storage.updateKeyResult(params.keyResultId, updateData);

      return success({
        message: 'Key Result progress updated successfully',
        keyResult: {
          id: updated.id,
          title: updated.title,
          currentValue: updated.currentValue,
          targetValue: updated.targetValue,
          progress: updated.progress,
          status: updated.status,
        },
      });
    },
  },

  add_check_in_note: {
    description: 'Add a check-in note to an Objective. This updates the last check-in note and timestamp.',
    inputSchema: z.object({
      objectiveId: z.string().describe('The ID of the Objective to add the note to'),
      note: z.string().max(2000).describe('The check-in note content (max 2000 characters)'),
    }),
    requiredScope: MCP_SCOPES.WRITE_OKRS,
    execute: async (params: { objectiveId: string; note: string }, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.WRITE_OKRS)) {
        return error('Permission denied: write:okrs scope required');
      }

      // Get the objective to verify tenant ownership
      const objective = await storage.getObjectiveById(params.objectiveId);
      if (!objective) {
        return error('Objective not found');
      }

      // Verify tenant ownership
      if (objective.tenantId !== context.tenant.id) {
        return error('Permission denied: Objective belongs to a different organization');
      }

      // Update the objective with the check-in note
      const updated = await storage.updateObjective(params.objectiveId, {
        lastCheckInNote: params.note,
        lastCheckInAt: new Date(),
      } as any);

      return success({
        message: 'Check-in note added successfully',
        objective: {
          id: updated.id,
          title: updated.title,
          lastCheckInNote: updated.lastCheckInNote,
          lastCheckInAt: updated.lastCheckInAt,
        },
      });
    },
  },

  update_big_rock_status: {
    description: 'Update the status and/or completion percentage of a Big Rock.',
    inputSchema: z.object({
      bigRockId: z.string().describe('The ID of the Big Rock to update'),
      status: z.enum(['not_started', 'on_track', 'behind', 'at_risk', 'postponed', 'completed', 'closed']).optional().describe('New status for the Big Rock'),
      completionPercentage: z.number().min(0).max(100).optional().describe('Completion percentage (0-100)'),
    }),
    requiredScope: MCP_SCOPES.WRITE_BIG_ROCKS,
    execute: async (params: { bigRockId: string; status?: string; completionPercentage?: number }, context: McpAuthContext): Promise<McpToolResult> => {
      if (!hasScope(context, MCP_SCOPES.WRITE_BIG_ROCKS)) {
        return error('Permission denied: write:big_rocks scope required');
      }

      // Get the big rock to verify tenant ownership
      const bigRock = await storage.getBigRockById(params.bigRockId);
      if (!bigRock) {
        return error('Big Rock not found');
      }

      // Verify tenant ownership
      if (bigRock.tenantId !== context.tenant.id) {
        return error('Permission denied: Big Rock belongs to a different organization');
      }

      // Ensure at least one field is being updated
      if (params.status === undefined && params.completionPercentage === undefined) {
        return error('At least one of status or completionPercentage must be provided');
      }

      // Build update data
      const updateData: Record<string, any> = {};
      if (params.status !== undefined) {
        updateData.status = params.status;
      }
      if (params.completionPercentage !== undefined) {
        updateData.completionPercentage = params.completionPercentage;
      }

      const updated = await storage.updateBigRock(params.bigRockId, updateData);

      return success({
        message: 'Big Rock updated successfully',
        bigRock: {
          id: updated.id,
          title: updated.title,
          status: updated.status,
          completionPercentage: updated.completionPercentage,
        },
      });
    },
  },
};

export type McpToolName = keyof typeof mcpTools;
