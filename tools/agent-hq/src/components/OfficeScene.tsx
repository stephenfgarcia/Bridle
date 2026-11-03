import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Agent, Project } from "../data/types";
import { globeAnchor, headAnchor, layoutDesks, STAGE_H, STAGE_W } from "../lib/layout";
import { Desk } from "./Desk";
import { HoloGlobe } from "./HoloGlobe";
import { CeilingDressing, CityWindow, Plant, ServerRacks } from "./RoomDressing";
import { ScreenWall } from "./ScreenWall";

interface Props {
  project: Project;
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  tv: boolean;
}

const GRID_LINES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const GRID_ROWS = [0.12, 0.26, 0.42, 0.6, 0.8];

function RoomBackdrop() {
  return (
    <>
      <div className="room-wallback" />
      <CeilingDressing />
      <div className="room-strip room-strip--1" />
      <div className="room-strip room-strip--2" />
      <div className="room-strip room-strip--3" />
      <div className="room-floor" />
      <svg className="room-grid" viewBox="0 0 1600 528" aria-hidden="true">
        {GRID_LINES.map((i) => {
          const xBottom = (i / (GRID_LINES.length - 1)) * 2400 - 400;
          return (
            <line
              key={i}
              x1={800}
              y1={-60}
              x2={xBottom}
              y2={528}
              stroke="#8b5cf6"
              strokeWidth={1}
              opacity={0.16}
            />
          );
        })}
        {GRID_ROWS.map((t) => (
          <line
            key={t}
            x1={0}
            y1={t * 528}
            x2={1600}
            y2={t * 528}
            stroke="#8b5cf6"
            strokeWidth={1}
            opacity={0.1 + t * 0.12}
          />
        ))}
      </svg>
      <div className="room-reflection" />
      <div className="room-haze room-haze--1" />
      <div className="room-haze room-haze--2" />
    </>
  );
}

/** The 2.5D office: a fixed 1600x900 stage scaled to fit its container. */
export function OfficeScene({ project, agents, selectedId, onSelect, tv }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const slots = useMemo(() => layoutDesks(agents.length), [agents.length]);
  const [spotTick, setSpotTick] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScale(Math.min(rect.width / STAGE_W, rect.height / STAGE_H));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!tv) return;
    setSpotTick(0);
    const id = window.setInterval(() => setSpotTick((t) => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, [tv]);

  const spotIndex = tv && agents.length > 0 ? spotTick % agents.length : -1;
  const spotSlot = spotIndex >= 0 ? slots[spotIndex] : undefined;
  const globe = globeAnchor(slots);
  const slotById = new Map(agents.map((a, i) => [a.id, slots[i]] as const));

  const waitingLines = agents.flatMap((a) => {
    if (a.status !== "waiting" || !a.waitingOn || a.waitingOn === "human") return [];
    const from = slotById.get(a.id);
    const to = slotById.get(a.waitingOn);
    if (!from || !to) return [];
    const p1 = headAnchor(from);
    const p2 = headAnchor(to);
    const cx = (p1.x + p2.x) / 2;
    const cy = Math.min(p1.y, p2.y) - 70 - Math.abs(p1.x - p2.x) * 0.08;
    return [{ id: `${a.id}->${a.waitingOn}`, d: `M${p1.x} ${p1.y} Q${cx} ${cy} ${p2.x} ${p2.y}` }];
  });

  return (
    <div className="stage-viewport" ref={viewportRef}>
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className={tv ? "stage-inner stage-inner--drift" : "stage-inner"}>
          <RoomBackdrop />
          <CityWindow />
          <ServerRacks side="left" />
          <ServerRacks side="right" />
          <ScreenWall project={project} agents={agents} />
          <Plant x={36} y={896} scale={1} />
          <Plant x={1566} y={896} scale={0.92} />
          <Plant x={108} y={556} scale={0.5} z={4} />
          <Plant x={1492} y={556} scale={0.5} z={4} />
          <HoloGlobe x={globe.x} y={globe.y} />
          {agents.map((agent, i) => {
            const slot = slots[i];
            if (!slot) return null;
            return (
              <Desk
                key={agent.id}
                agent={agent}
                slot={slot}
                selected={agent.id === selectedId}
                spotlit={i === spotIndex}
                dimmed={spotIndex >= 0 && i !== spotIndex}
                onSelect={onSelect}
              />
            );
          })}
          <svg className="stage-lines" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} aria-hidden="true">
            {waitingLines.map((line) => (
              <g key={line.id}>
                <path className="wait-line wait-line--glow" d={line.d} />
                <path className="wait-line" d={line.d} />
              </g>
            ))}
          </svg>
          {spotSlot && (
            <motion.div
              className="spotlight"
              initial={false}
              animate={{ left: spotSlot.x, top: spotSlot.y - 150 * spotSlot.scale }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
