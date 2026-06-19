"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const slogans = [
  "Discover startups. Connect with investors.",
  "Where builders meet backers.",
  "The startup ecosystem, all in one place.",
  "Fund the future. Build what matters.",
];

export function HomeHero() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % slogans.length);
        setVisible(true);
      }, 350);
      return () => clearTimeout(t);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <p
        className="mt-6 h-10 max-w-2xl text-2xl text-text-muted max-md:text-xl"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 350ms ease, transform 350ms ease",
        }}
      >
        {slogans[index]}
      </p>

      <div className="mt-12 flex gap-5">
        <Link href="/startups" className="btn-primary px-10 py-4 text-lg">
          Browse Startups
        </Link>
        <Link
          href="/investors"
          className="btn-ghost px-10 py-4 text-lg text-text"
          style={{ borderColor: "var(--color-text-muted)" }}
        >
          Meet Investors
        </Link>
      </div>
    </>
  );
}
