"use client";

import Link from "next/link";
import { useState, type PointerEvent } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import styles from "./wallet-scene.module.css";

export function WalletCover() {
  const segment = useSelectedLayoutSegment();
  if (segment !== "login") {
    return <aside className="wallet-cover"><Link href="/" aria-label="Evenly home" className="wallet-wordmark">Evenly<span>.</span></Link></aside>;
  }
  return <WalletScene />;
}

function WalletScene() {
  const [night, setNight] = useState(false);
  const reduced = useReducedMotion();
  const horizontal = useMotionValue(0);
  const vertical = useMotionValue(0);
  const rotateY = useSpring(horizontal, { stiffness: 130, damping: 21 });
  const rotateX = useSpring(vertical, { stiffness: 130, damping: 21 });

  function move(event: PointerEvent<HTMLElement>) {
    if (reduced || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    horizontal.set(((event.clientX - rect.left) / rect.width - 0.5) * 17);
    vertical.set((0.5 - (event.clientY - rect.top) / rect.height) * 13);
  }

  return (
    <aside className={styles.scene} data-night={night} onPointerMove={move} onPointerLeave={() => { horizontal.set(0); vertical.set(0); }}>
      <Link className={styles.brand} href="/" aria-label="Evenly home">Evenly<span>.</span></Link>
      <div className={styles.stage} aria-hidden>
        <motion.div className={styles.object} style={{ rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY }}>
          <div className={styles.medallion}><div className={styles.art} /><div className={styles.glint} /></div>
          <div className={styles.orbit}><i /></div>
          <div className={styles.crossOrbit} />
        </motion.div>
      </div>
      <button type="button" className={styles.switch} aria-label="Ultraviolet artwork lighting" aria-pressed={night} onClick={() => setNight(!night)}>
        {night ? <Moon size={15} aria-hidden /> : <Sun size={15} aria-hidden />}
        <span>{night ? "Ultraviolet" : "Daylight"}</span>
        <span className={styles.track} aria-hidden><i /></span>
      </button>
    </aside>
  );
}
