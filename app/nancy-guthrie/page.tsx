"use client";

import { useEffect } from "react";

const CONVAI_SCRIPT_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";

export default function NancyGuthriePage() {
  useEffect(() => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src=\"${CONVAI_SCRIPT_SRC}\"]`,
    );

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = CONVAI_SCRIPT_SRC;
    script.async = true;
    script.type = "text/javascript";

    document.body.appendChild(script);
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(70rem_36rem_at_8%_-12%,rgba(229,9,20,0.24),transparent_60%),radial-gradient(62rem_34rem_at_92%_8%,rgba(178,7,16,0.2),transparent_62%),linear-gradient(180deg,#07090d_0%,#0b1018_100%)] px-4 pb-20 pt-28 text-white">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-white/15 bg-[linear-gradient(145deg,rgba(229,9,20,0.16),rgba(10,13,20,0.95)_36%,rgba(10,13,20,0.95))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.5)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          Conversation Experience
        </p>

        <h1 className="mt-2 font-display text-5xl uppercase tracking-[0.05em] text-white sm:text-7xl">
          Nancy Guthrie
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
          Start a live voice conversation below.
        </p>

        <div className="mt-8 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm sm:p-6">
          <div
            dangerouslySetInnerHTML={{
              __html:
                '<elevenlabs-convai agent-id="agent_3501kj12k625f0rtwbdb3p53syr2" variant="expanded" dismissible="false" avatar-orb-color-1="#e50914" avatar-orb-color-2="#3d0a0d" style="display:block;width:100%;min-height:620px;border-radius:16px;overflow:hidden;"></elevenlabs-convai>',
            }}
          />
        </div>
      </section>
    </main>
  );
}
