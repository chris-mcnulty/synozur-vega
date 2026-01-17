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
};

export type McpToolName = keyof typeof mcpTools;
