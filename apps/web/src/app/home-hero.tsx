"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

      <div className="pointer-events-auto mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="w-full text-base sm:w-auto">
          <Link href="/startups">Browse Startups</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full border-text-muted text-base text-text sm:w-auto"
        >
          <Link href="/investors">Meet Investors</Link>
        </Button>
      </div>
    </>
  );
}
