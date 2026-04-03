import { Box, Text, useInput } from 'ink';
import { useState, useMemo } from 'react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Header from './Header';

interface GatesViewProps {
  onBack: () => void;
}

interface GateDefinition {
  id: string;
  description: string;
}

const CC_CONFIG_PATH = path.join(os.homedir(), '.claude.json');

const GATES: GateDefinition[] = [
  // ====== User-Facing Features ======
  {
    id: 'tengu_auto_background_agents',
    description: 'Auto-launch background agents after 2min idle',
  },
  {
    id: 'tengu_terminal_sidebar',
    description: 'Show status in terminal tab title',
  },
  {
    id: 'tengu_keybinding_customization_release',
    description: 'Custom keybinding support (~/.claude/keybindings.json)',
  },
  {
    id: 'tengu_immediate_model_command',
    description: 'Instant /model command (no cooldown)',
  },
  {
    id: 'tengu_destructive_command_warning',
    description: 'Warn before destructive bash commands',
  },
  {
    id: 'tengu_chomp_inflection',
    description: 'Prompt suggestions after responses',
  },
  {
    id: 'tengu_scratch',
    description: 'Scratchpad directory for session working files',
  },
  {
    id: 'tengu_surreal_dali',
    description: 'Remote triggers (scheduled agent runs)',
  },
  {
    id: 'tengu_remote_backend',
    description: 'Remote sessions (--remote flag)',
  },
  {
    id: 'tengu_cobalt_frost',
    description: 'Voice mode: Nova 3 STT engine',
  },
  {
    id: 'tengu_lodestone_enabled',
    description: 'Deep link registration (claude:// protocol)',
  },
  {
    id: 'tengu_chrome_auto_enable',
    description: 'Auto-enable Claude-in-Chrome MCP',
  },
  {
    id: 'tengu_thinkback',
    description: '/think-back: year in review command',
  },
  {
    id: 'tengu_onyx_plover',
    description: 'Auto-dream (background memory consolidation)',
  },
  {
    id: 'tengu_review_bughunter_config',
    description: 'Ultra-review bug hunter mode',
  },
  {
    id: 'tengu_lapis_finch',
    description: 'Plugin hint suggestions',
  },
  // ====== Agents & Planning ======
  {
    id: 'tengu_amber_flint',
    description: 'Agent teams (multi-agent coordination)',
  },
  {
    id: 'tengu_amber_stoat',
    description: 'Built-in verification + exploration agents',
  },
  {
    id: 'tengu_amber_prism',
    description: 'Extended permission prompt instructions',
  },
  {
    id: 'tengu_sage_compass',
    description: 'Advisor tool (background analysis)',
  },
  {
    id: 'tengu_agent_list_attach',
    description: 'Attach agent list to messages for routing',
  },
  // ====== Memory & Context ======
  {
    id: 'tengu_session_memory',
    description: 'Session memory (auto-extraction + search)',
  },
  {
    id: 'tengu_sm_compact',
    description: 'Session memory compaction',
  },
  {
    id: 'tengu_cold_compact',
    description: 'Cold compaction for stale context',
  },
  {
    id: 'tengu_bramble_lintel',
    description: 'Memory extraction frequency threshold',
  },
  {
    id: 'tengu_paper_halyard',
    description: 'Filter project/local CLAUDE.md from system prompt',
  },
  {
    id: 'tengu_slim_subagent_claudemd',
    description: 'Slim CLAUDE.md for subagents (omit full context)',
  },
  {
    id: 'tengu_gleaming_fair',
    description: 'Resume idle sessions with context refresh',
  },
  // ====== Streaming & Performance ======
  {
    id: 'tengu_streaming_tool_execution2',
    description: 'Stream tool execution results incrementally',
  },
  {
    id: 'tengu_fgts',
    description: 'Fine-grained tool streaming (eager input)',
  },
  {
    id: 'tengu_compact_streaming_retry',
    description: 'Retry failed compaction streams',
  },
  {
    id: 'tengu_compact_cache_prefix',
    description: 'Cache prefix for compaction (reduce API costs)',
  },
  {
    id: 'tengu_otk_slot_v1',
    description: 'Auto-escalate max output tokens on truncation',
  },
  {
    id: 'tengu_disable_keepalive_on_econnreset',
    description: 'Disable keep-alive on stale connections',
  },
  {
    id: 'tengu_turtle_carbon',
    description: 'Ultrathink support (extended thinking mode)',
  },
  {
    id: 'tengu_miraculo_the_bard',
    description: 'Deferred startup prefetch (faster startup)',
  },
  // ====== Tool Behavior ======
  {
    id: 'tengu_toolref_defer_j8m',
    description: 'Deferred tool reference loading (save context)',
  },
  {
    id: 'tengu_hawthorn_steeple',
    description: 'Image dedup in message history',
  },
  {
    id: 'tengu_quartz_lantern',
    description: 'Compute diffs for remote file edits',
  },
  {
    id: 'tengu_basalt_3kr',
    description: 'MCP instruction delta attachments',
  },
  {
    id: 'tengu_mcp_subagent_prompt',
    description: 'Improved MCP truncation prompt for subagents',
  },
  {
    id: 'tengu_plum_vx3',
    description: 'Disable thinking for web search queries',
  },
  {
    id: 'tengu_pebble_leaf_prune',
    description: 'Prune orphan message branches',
  },
  // ====== Misc / Infrastructure ======
  {
    id: 'tengu_jade_anvil_4',
    description: 'Extended usage / overage controls',
  },
  {
    id: 'tengu_pid_based_version_locking',
    description: 'PID-based version locking (prevent update conflicts)',
  },
  {
    id: 'tengu_attribution_header',
    description: 'Send attribution header with API requests',
  },
  {
    id: 'tengu_cork_m4q',
    description: 'Enhanced batch command processing prompt',
  },
  {
    id: 'tengu_harbor',
    description: 'MCP channel notifications (harbor)',
  },
  {
    id: 'tengu_willow_mode',
    description: 'Willow idle detection mode',
  },
  {
    id: 'tengu_marble_sandcastle',
    description: 'Require native binary for fast mode',
  },
];

function readOverrides(): Record<string, boolean> {
  try {
    const config = JSON.parse(fs.readFileSync(CC_CONFIG_PATH, 'utf8'));
    return config.growthBookOverrides ?? {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Record<string, boolean>): void {
  try {
    const config = JSON.parse(fs.readFileSync(CC_CONFIG_PATH, 'utf8'));
    if (Object.keys(overrides).length === 0) {
      delete config.growthBookOverrides;
    } else {
      config.growthBookOverrides = overrides;
    }
    fs.writeFileSync(CC_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch {
    // Config file missing or unreadable
  }
}

const ITEMS_PER_PAGE = 6;

export function GatesView({ onBack }: GatesViewProps) {
  const [overrides, setOverrides] =
    useState<Record<string, boolean>>(readOverrides);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const totalItems = GATES.length;
  const maxIndex = totalItems - 1;

  const scrollOffset = useMemo(() => {
    if (selectedIndex < ITEMS_PER_PAGE) return 0;
    return Math.min(
      selectedIndex - ITEMS_PER_PAGE + 1,
      totalItems - ITEMS_PER_PAGE
    );
  }, [selectedIndex, totalItems]);

  const visibleItems = GATES.slice(scrollOffset, scrollOffset + ITEMS_PER_PAGE);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + ITEMS_PER_PAGE < totalItems;

  useInput((input, key) => {
    if (key.return || key.escape) {
      onBack();
    } else if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(maxIndex, prev + 1));
    } else if (input === ' ') {
      const gate = GATES[selectedIndex];
      if (!gate) return;
      const next = { ...overrides };
      if (gate.id in next) {
        if (next[gate.id]) {
          next[gate.id] = false;
        } else {
          delete next[gate.id];
        }
      } else {
        next[gate.id] = true;
      }
      writeOverrides(next);
      setOverrides(next);
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Header>Feature Gates</Header>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Use ↑/↓ to navigate, space to cycle (unset → on → off → unset), enter
          to go back.
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Overrides are written to ~/.claude.json (growthBookOverrides).
          Requires the GrowthBook ant parity patch.
        </Text>
      </Box>

      {hasMoreAbove && (
        <Box>
          <Text dimColor> ↑ {scrollOffset} more above</Text>
        </Box>
      )}

      {visibleItems.map((gate, i) => {
        const actualIndex = scrollOffset + i;
        const isSelected = actualIndex === selectedIndex;
        const value = overrides[gate.id];
        const isSet = gate.id in overrides;

        let indicator: string;
        let statusText: string;
        let statusColor: string | undefined;

        if (!isSet) {
          indicator = '○';
          statusText = 'unset (default)';
          statusColor = undefined;
        } else if (value) {
          indicator = '●';
          statusText = 'ON';
          statusColor = 'green';
        } else {
          indicator = '◌';
          statusText = 'OFF';
          statusColor = 'red';
        }

        return (
          <Box key={gate.id} flexDirection="column">
            <Box>
              <Text>
                <Text color={isSelected ? 'cyan' : undefined}>
                  {isSelected ? '❯ ' : '  '}
                </Text>
                <Text bold color={isSelected ? 'cyan' : undefined}>
                  {gate.id}
                </Text>
              </Text>
            </Box>

            <Box>
              <Text dimColor>
                {'  '}
                {gate.description}
              </Text>
            </Box>

            <Box marginLeft={4} marginBottom={1}>
              <Text>
                {indicator} <Text color={statusColor}>{statusText}</Text>
              </Text>
            </Box>
          </Box>
        );
      })}

      {hasMoreBelow && (
        <Box>
          <Text dimColor>
            {' '}
            ↓ {totalItems - scrollOffset - ITEMS_PER_PAGE} more below
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          Gate {selectedIndex + 1} of {totalItems}
        </Text>
      </Box>
    </Box>
  );
}
