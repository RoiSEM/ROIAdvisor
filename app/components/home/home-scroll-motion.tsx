"use client";

import { useEffect, useRef } from "react";
import {
  anchorForScroll,
  buildTrace,
  cardScrollRange,
  columnIndex,
  lengthAtAnchor,
  type CardRange,
  type Trace,
} from "@/lib/scroll-motion";
import styles from "./home-landing.module.css";

/** Sum of offsets up the offsetParent chain: layout position, ignoring transforms. */
function offsetIn(el: HTMLElement, stop: Element | null = null) {
  let top = 0,
    left = 0;
  let node: HTMLElement | null = el;
  while (node && node !== stop) {
    top += node.offsetTop;
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return { top, left };
}

/**
 * Scroll-linked motion for the homepage. Renders only a decorative SVG; the
 * cards are server-rendered and fully visible until GSAP has loaded and the
 * visitor allows motion. Everything is created inside a gsap.matchMedia()
 * context so a live switch to reduced motion, or unmounting on client
 * navigation, reverts every tween, inline style and ScrollTrigger.
 */
export default function HomeScrollMotion() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current,
      line = pathRef.current,
      head = headRef.current,
      home = svg?.parentElement;
    if (!svg || !line || !head || !home) return;
    let disposed = false;
    let revert: (() => void) | undefined;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();
        revert = () => mm.revert();

        mm.add("screen and (prefers-reduced-motion: no-preference)", () => {
          home.setAttribute("data-motion", "on");
          const cards = Array.from(home.querySelectorAll<HTMLElement>("[data-motion-card]"));

          // ---- card ranges: measured once per ScrollTrigger refresh ----
          let ranges: Map<HTMLElement, CardRange | null> | null = null;
          const measureCards = () => {
            const vh = window.innerHeight;
            const max = ScrollTrigger.maxScroll(window);
            const boxes = cards.map((c) => offsetIn(c));
            const groups = cards.map((c) => c.closest("section"));
            ranges = new Map();
            cards.forEach((card, i) => {
              const peers = cards.map((_, j) => j).filter((j) => groups[j] === groups[i]);
              const col = columnIndex(
                peers.map((j) => boxes[j]),
                peers.indexOf(i),
              );
              ranges!.set(
                card,
                cardScrollRange({ top: boxes[i].top, viewportHeight: vh, maxScroll: max, column: col }),
              );
            });
          };
          const rangeFor = (card: HTMLElement) => {
            if (!ranges) measureCards();
            return ranges!.get(card) ?? null;
          };
          const onRefreshInit = () => {
            ranges = null;
          };
          ScrollTrigger.addEventListener("refreshInit", onRefreshInit);

          for (const card of cards) {
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: card,
                // Cards already in view at load (null range) keep progress 1.
                start: () => rangeFor(card)?.start ?? -2,
                end: () => rangeFor(card)?.end ?? -1,
                scrub: 0.5,
              },
            });
            tl.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: "none" }, 0).fromTo(
              card,
              { y: 72, rotationX: 22, scale: 0.965, transformPerspective: 1100, transformOrigin: "50% 100%" },
              { y: 0, rotationX: 0, scale: 1, duration: 1, ease: "power2.out" },
              0,
            );
          }

          // ---- accent trace along the grid gutters and section dividers ----
          let trace: Trace | null = null;
          let homeTop = 0,
            viewH = 1,
            maxS = 0;
          const state = { len: 0 };
          const draw = () => {
            if (!trace) return;
            const len = Math.min(trace.length, Math.max(0, state.len));
            line.style.strokeDashoffset = String(trace.length - len);
            const p = line.getPointAtLength(len);
            head.setAttribute("transform", `translate(${p.x} ${p.y})`);
            head.style.opacity = len > 0.5 && len < trace.length - 0.5 ? "1" : "0";
            svg.setAttribute("data-trace-progress", (len / trace.length).toFixed(4));
          };
          const lenTo = gsap.quickTo(state, "len", { duration: 0.45, ease: "power3", onUpdate: draw });
          const target = () =>
            trace
              ? lengthAtAnchor(
                  trace.knots,
                  anchorForScroll(window.scrollY, viewH, maxS) - homeTop,
                )
              : 0;
          const measureTrace = () => {
            const wrap = home.querySelector<HTMLElement>("#what-you-learn > *");
            homeTop = offsetIn(home).top;
            viewH = window.innerHeight;
            maxS = ScrollTrigger.maxScroll(window);
            const dividers = Array.from(home.querySelectorAll<HTMLElement>("main > section, footer"))
              .filter((el) => parseFloat(getComputedStyle(el).borderTopWidth) > 0)
              .map((el) => offsetIn(el, home).top);
            if (!wrap) return (trace = null);
            const cs = getComputedStyle(wrap);
            const w = offsetIn(wrap, home);
            trace = buildTrace({
              width: home.clientWidth,
              contentLeft: w.left + parseFloat(cs.paddingLeft),
              contentRight: w.left + wrap.clientWidth - parseFloat(cs.paddingRight),
              dividers,
            });
            svg.setAttribute("data-trace-mode", trace?.mode ?? "none");
            if (!trace) return line.removeAttribute("d");
            line.setAttribute("d", trace.d);
            line.style.strokeDasharray = `${trace.length} ${trace.length}`;
            state.len = target();
            lenTo(state.len, state.len);
            draw();
          };
          ScrollTrigger.create({
            start: 0,
            end: "max",
            onRefresh: measureTrace,
            onUpdate: () => lenTo(target()),
          });

          // Content height changes (fonts, opening a DIY outline) move the
          // dividers and cards: re-measure once per frame, never per scroll.
          let raf = 0,
            first = true;
          const ro = new ResizeObserver(() => {
            if (first) return void (first = false);
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => ScrollTrigger.refresh());
          });
          const main = home.querySelector("main");
          if (main) ro.observe(main);

          return () => {
            ro.disconnect();
            cancelAnimationFrame(raf);
            ScrollTrigger.removeEventListener("refreshInit", onRefreshInit);
            home.removeAttribute("data-motion");
            svg.removeAttribute("data-trace-progress");
            svg.removeAttribute("data-trace-mode");
            line.removeAttribute("d");
            line.style.strokeDasharray = "";
            line.style.strokeDashoffset = "";
          };
        });
      })
      .catch(() => {
        // Progressive enhancement: without GSAP the page simply stays static.
      });

    return () => {
      disposed = true;
      revert?.();
    };
  }, []);

  return (
    <svg ref={svgRef} className={styles.trace} aria-hidden="true" focusable="false" data-motion-trace="">
      <path ref={pathRef} className={styles.traceLine} />
      <g ref={headRef} className={styles.traceHead}>
        <circle r="8" className={styles.traceHalo} />
        <circle r="3.5" />
      </g>
    </svg>
  );
}
