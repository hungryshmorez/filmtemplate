// OutputPanel.tsx — Right rail: Showrunner preview / Seedance export / AI scene
// generator. The active panel is driven by the top-bar workspace mode; all
// three stay mounted so in-progress drafts survive mode switches.
import clsx from "clsx";
import { MonitorPlay, Video, WandSparkles } from "lucide-react";
// (className plumbed from App for responsive show/hide + fixed rail width)
import type { CharacterEntity, EpisodeEntity, SceneEntity, SetEntity, ShowMeta } from "../types";
import { ShowrunnerPanel } from "./ShowrunnerPanel";
import { SeedancePanel } from "./SeedancePanel";
import { AiScenePanel } from "./AiScenePanel";

export type OutputMode = "showrunner" | "seedance" | "ai";

const MODE_META: Record<OutputMode, { label: string; icon: typeof MonitorPlay }> = {
  showrunner: { label: "Showrunner preview", icon: MonitorPlay },
  seedance: { label: "Seedance export", icon: Video },
  ai: { label: "AI Scene generator", icon: WandSparkles },
};

interface OutputPanelProps {
  mode: OutputMode;
  show: ShowMeta | null;
  episode: EpisodeEntity | null;
  scene: SceneEntity | null;
  set: SetEntity | undefined;
  sets: SetEntity[];
  characters: CharacterEntity[];
  onSceneApplied: (sceneId: string) => void;
  className?: string;
}

export function OutputPanel({ mode, show, episode, scene, set, sets, characters, onSceneApplied, className }: OutputPanelProps) {
  const { label, icon: Icon } = MODE_META[mode];

  return (
    <aside
      className={clsx(
        "h-full w-full min-h-0 flex-col border-neutral-800 bg-neutral-900/30 lg:w-[360px] lg:shrink-0 lg:border-l",
        className
      )}
    >
      {/* Header — the active panel is chosen by the top-bar workspace mode. */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-800 bg-neutral-900/70 px-3 py-2">
        <Icon size={12} className="text-amber-300" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{label}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div role="tabpanel" aria-label="Showrunner preview" hidden={mode !== "showrunner"}>
          <ShowrunnerPanel scene={scene} set={set} characters={characters} />
        </div>
        <div role="tabpanel" aria-label="Seedance export" hidden={mode !== "seedance"}>
          <SeedancePanel scene={scene} set={set} characters={characters} />
        </div>
        <div role="tabpanel" aria-label="AI scene generator" hidden={mode !== "ai"}>
          <AiScenePanel
            show={show}
            episode={episode}
            scene={scene}
            sets={sets}
            characters={characters}
            onApplied={onSceneApplied}
          />
        </div>
      </div>
    </aside>
  );
}
