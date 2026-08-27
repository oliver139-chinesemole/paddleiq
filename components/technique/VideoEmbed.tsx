"use client";

import { useState, useSyncExternalStore } from "react";
import { Play, WifiOff, ExternalLink } from "lucide-react";

export interface LessonVideo {
  youtubeId: string;
  title: string;
  channel: string;
  channelUrl: string;
}

/** Subscribes to the browser's online/offline state. */
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * A YouTube video, loaded only when the athlete asks for it.
 *
 * This is a facade: a thumbnail and a play button until it's clicked, at which
 * point the real player is inserted. That matters for three separate reasons.
 * YouTube's embed pulls in several hundred kilobytes of player, which would
 * undo the work done to keep this app light on a phone. It sets third-party
 * cookies the moment it loads, which shouldn't happen to someone who never
 * pressed play. And an iframe that loads on mount would sit there failing on
 * every page view when the athlete is at a boathouse with no signal.
 *
 * The player is nocookie, and the thumbnail comes from YouTube's static image
 * host rather than the player, so nothing tracks anyone before they choose to
 * watch.
 */
export function VideoEmbed({ video }: { video: LessonVideo }) {
  const [playing, setPlaying] = useState(false);

  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    // The server can't know, and assuming offline would render the wrong
    // thing for everyone on first paint.
    () => true,
  );

  const watchUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;

  if (!online) {
    return (
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <div className="flex items-start gap-2.5">
          <WifiOff size={15} className="text-[#7C8AA0] shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-[#C3CEDC]">Video needs a connection</p>
            <p className="text-xs text-[#8A98AC] leading-relaxed mt-1">
              This one is hosted on YouTube, so it can&apos;t play offline. The written
              cues, mistakes and drills below all work without a signal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] overflow-hidden">
      <div className="relative w-full aspect-video bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full cursor-pointer"
            aria-label={`Play video: ${video.title}`}
          >
            {/* Plain <img>: this is a third-party host that next/image would
                need configuring for, and it's one thumbnail. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0EA5E9] shadow-lg transition-transform group-hover:scale-110">
                <Play size={22} className="text-white ml-0.5" fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="p-4">
        <p className="text-sm font-bold text-[#F1F5F9] leading-snug">{video.title}</p>
        {/* Credited and linked. It's someone else's work. */}
        <p className="text-xs text-[#8A98AC] mt-1">
          by{" "}
          <a
            href={video.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0EA5E9] underline underline-offset-2"
          >
            {video.channel}
          </a>{" "}
          on YouTube
        </p>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[#7C8AA0] hover:text-[#94A3B8] mt-2"
        >
          Watch on YouTube <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
