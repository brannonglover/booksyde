"use client";

import { AVATAR_SIZE, removeMyAvatar, setMyAvatar } from "@booksyde/shared";
import { useRouter } from "next/navigation";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";

/*
 * Your photo: take one with the computer's camera or upload any image, then
 * drag and zoom it into the circle. It saves as soon as you confirm, apart
 * from the rest of the bookplate form.
 */

const VIEW = 288; // crop circle, in CSS pixels
const MAX_FILE = 20 * 1024 * 1024;

type Step = { kind: "closed" } | { kind: "camera" } | { kind: "crop"; image: HTMLImageElement; url: string };

export function AvatarPicker({
  name,
  ink,
  src,
  onChange,
}: {
  name: string;
  ink: string;
  src: string | null;
  onChange: (url: string | null) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [hasCamera, setHasCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only offer the camera where the browser can use one (secure pages with mediaDevices).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability, unknown until mounted
    setHasCamera(typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (step.kind === "closed" && d.open) d.close();
    if (step.kind !== "closed" && !d.open) d.showModal();
  }, [step.kind]);

  function close() {
    if (step.kind === "crop") URL.revokeObjectURL(step.url);
    setStep({ kind: "closed" });
  }

  async function openImage(blob: Blob) {
    setError(null);
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      setStep({ kind: "closed" });
      setError("We couldn’t open that image. Try a JPEG or PNG.");
      return;
    }
    setStep({ kind: "crop", image, url });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("That file isn’t an image.");
    if (file.size > MAX_FILE) return setError("That image is over 20 MB. Try a smaller one.");
    void openImage(file);
  }

  async function save(photo: Blob) {
    setBusy(true);
    setError(null);
    try {
      const url = await setMyAvatar(createClient(), photo, "image/jpeg");
      onChange(url);
      close();
      router.refresh(); // header avatar
    } catch (e) {
      console.error("[avatar] save failed", e);
      setError("We couldn’t save your photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await removeMyAvatar(createClient());
      onChange(null);
      router.refresh();
    } catch (e) {
      console.error("[avatar] remove failed", e);
      setError("We couldn’t remove your photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const button =
    "rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:border-text/40 hover:bg-surface disabled:opacity-60";

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your photo</legend>
      <div className="flex flex-wrap items-center gap-5">
        <Avatar
          name={name}
          src={src}
          ink={ink}
          className="size-20 rounded-full border-4 border-double text-4xl"
          style={{ borderColor: "var(--bk-gilt)" }}
        />
        <div className="flex flex-wrap gap-2">
          {hasCamera ? (
            <button type="button" className={button} disabled={busy} onClick={() => (setError(null), setStep({ kind: "camera" }))}>
              Take a photo
            </button>
          ) : null}
          <button type="button" className={button} disabled={busy} onClick={() => fileInput.current?.click()}>
            {src ? "Upload a new photo" : "Upload a photo"}
          </button>
          {src ? (
            <button type="button" className={`${button} text-accent`} disabled={busy} onClick={remove}>
              {busy && step.kind === "closed" ? "Removing…" : "Remove"}
            </button>
          ) : null}
        </div>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      <p className="text-sm text-muted">Shows on your bookplate, reviews and club posts. Without one, your initial shows in your ink.</p>
      {error && step.kind === "closed" ? <p className="text-sm text-accent">{error}</p> : null}

      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) close();
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface-raised p-6 text-text shadow-2xl backdrop:bg-ink/60"
      >
        {step.kind === "camera" ? (
          <CameraStep onCapture={openImage} onCancel={close} />
        ) : step.kind === "crop" ? (
          <CropStep
            key={step.url}
            image={step.image}
            busy={busy}
            error={error}
            onSave={save}
            onCancel={close}
          />
        ) : null}
      </dialog>
    </fieldset>
  );
}

const CAMERA_KEY = "booksyde.camera";

/**
 * Which camera to open: one the reader chose, or "pick a sensible one" — the
 * computer's own camera, or the front camera on a phone. `avoid` skips a
 * camera that just disconnected.
 */
type CameraRequest = { deviceId: string } | { auto: true; avoid?: string };

function savedCamera(): CameraRequest {
  try {
    const id = localStorage.getItem(CAMERA_KEY);
    if (id) return { deviceId: id };
  } catch {
    // private mode etc.
  }
  return { auto: true };
}

function rememberCamera(id: string) {
  try {
    localStorage.setItem(CAMERA_KEY, id);
  } catch {
    // ignore
  }
}

/** "FaceTime HD Camera (05ac:8514)" → "FaceTime HD Camera". */
function cameraName(device: MediaDeviceInfo | undefined, i = 0) {
  return device?.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, "") || `Camera ${i + 1}`;
}

/** An iPhone or iPad lent to the computer (Continuity Camera), or its Desk View. */
const isPhoneCamera = (d: MediaDeviceInfo) => /iphone|ipad|continuity|desk view/i.test(d.label);

/** The computer's own camera if there is one, then any camera that isn't a phone. */
function preferredCamera(cameras: MediaDeviceInfo[]) {
  return (
    cameras.find((d) => /facetime|built-in|integrated/i.test(d.label)) ?? cameras.find((d) => !isPhoneCamera(d)) ?? cameras[0]
  );
}

/** Phones and tablets: open the front camera rather than guessing by name. */
const isTouchDevice = () => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

async function listCameras() {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "videoinput" && d.deviceId);
}

function CameraStep({ onCapture, onCancel }: { onCapture: (photo: Blob) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  // The open camera. Attached to the <video> after render, since the video isn't on screen while an error shows.
  const live = useRef<MediaStream | null>(null);
  const [request, setRequest] = useState<CameraRequest>(savedCamera);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  // What actually opened: its id (for the menu), whether it faces you (mirror it), and whether it can flip.
  const [active, setActive] = useState<{ id?: string; mirror: boolean; facing?: string } | null>(null);
  const [problem, setProblem] = useState<"blocked" | "busy" | "failed" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // The camera is open but showing nothing: paused on the phone, or no picture arriving.
  const [stuck, setStuck] = useState<"paused" | "no-picture" | null>(null);

  // Keep the menu current as cameras come and go (an iPhone nearby appears as a Continuity Camera).
  useEffect(() => {
    const md = navigator.mediaDevices;
    const refresh = () => listCameras().then(setCameras).catch(() => {});
    refresh();
    md.addEventListener?.("devicechange", refresh);
    return () => md.removeEventListener?.("devicechange", refresh);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let noPicture: ReturnType<typeof setTimeout> | undefined;
    // Ask for full HD. (Asking for 1280×1280 made browsers pick 720p, the "closest" mode, on 1080p cameras.)
    const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const open = (video: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video: { ...size, ...video }, audio: false });

    async function start() {
      let known = await listCameras().catch(() => [] as MediaDeviceInfo[]);
      const avoid = "avoid" in request ? request.avoid : undefined;
      const usable = known.filter((d) => d.deviceId !== avoid);
      // Names (and stable ids) are only visible once camera access has been allowed.
      const best = preferredCamera(usable.filter((d) => d.label));

      // Try the camera we want first, then every other camera, then "any camera at all", so a stale
      // saved id (Safari changes them between visits) or a just-disconnected iPhone that macOS still
      // calls the default doesn't leave the reader with no camera.
      const tries: (MediaTrackConstraints | null)[] = [];
      if ("deviceId" in request) tries.push({ deviceId: { exact: request.deviceId } });
      else if (isTouchDevice()) tries.push({ facingMode: "user" });
      for (const d of [best, ...usable]) if (d) tries.push({ deviceId: { exact: d.deviceId } });
      tries.push(null);

      let s: MediaStream | null = null;
      let lastError: unknown = null;
      const seen = new Set<string>();
      for (const t of tries) {
        const key = JSON.stringify(t);
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          s = t ? await open(t) : await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          break;
        } catch (e) {
          lastError = e;
          console.warn("[camera] couldn’t open", t ?? "any camera", e);
          // No permission: every other camera will say the same.
          if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")) throw e;
        }
      }
      if (!s) throw lastError;

      known = await listCameras().catch(() => known);
      const openedId = s.getVideoTracks()[0]?.getSettings().deviceId;
      // The saved camera didn't open: stop insisting on it.
      if ("deviceId" in request && openedId !== request.deviceId) {
        try {
          if (localStorage.getItem(CAMERA_KEY) === request.deviceId) localStorage.removeItem(CAMERA_KEY);
        } catch {
          // ignore
        }
      }
      // First time here, macOS may have handed us the iPhone. Swap to the computer's own camera.
      const opened = known.find((d) => d.deviceId === openedId);
      const better = preferredCamera(known.filter((d) => d.deviceId !== avoid));
      if ("auto" in request && !best && opened && isPhoneCamera(opened) && better && !isPhoneCamera(better)) {
        try {
          const swapped = await open({ deviceId: { exact: better.deviceId } });
          s.getTracks().forEach((t) => t.stop());
          s = swapped;
        } catch {
          // Keep the iPhone; the reader can pick another camera from the menu.
        }
      }
      if (cancelled) return s.getTracks().forEach((t) => t.stop());
      stream = s;
      if (!cancelled) setCameras(known);

      const track = s.getVideoTracks()[0];
      const settings = track?.getSettings() ?? {};
      const name = cameraName(known.find((d) => d.deviceId === settings.deviceId));
      setProblem(null);
      setStuck(null);
      setActive({ id: settings.deviceId, facing: settings.facingMode, mirror: settings.facingMode !== "environment" });
      live.current = s;

      // Disconnected (e.g. "Disconnect" on the iPhone): move to another camera rather than sit on black.
      track?.addEventListener("ended", () => {
        if (cancelled) return;
        // Disconnecting the camera you'd picked means you don't want it by default either.
        try {
          if (settings.deviceId && localStorage.getItem(CAMERA_KEY) === settings.deviceId) localStorage.removeItem(CAMERA_KEY);
        } catch {
          // ignore
        }
        setNotice(`${name} disconnected, so we switched cameras.`);
        setReady(false);
        setActive(null);
        setRequest({ auto: true, avoid: settings.deviceId });
      });
      // Paused (e.g. "Pause" on the iPhone): say so.
      track?.addEventListener("mute", () => !cancelled && setStuck("paused"));
      track?.addEventListener("unmute", () => !cancelled && setStuck(null));
      // Open but no picture after a few seconds: say so instead of showing black forever.
      noPicture = setTimeout(() => {
        if (!cancelled && (video.current?.readyState ?? 0) < 2) setStuck((st) => st ?? "no-picture");
      }, 5000);
    }

    start().catch((e: unknown) => {
      if (cancelled) return;
      const kind = e instanceof DOMException ? e.name : "";
      setProblem(kind === "NotAllowedError" || kind === "SecurityError" ? "blocked" : kind === "NotReadableError" ? "busy" : "failed");
      listCameras().then(setCameras).catch(() => {});
    });
    return () => {
      cancelled = true;
      clearTimeout(noPicture);
      stream?.getTracks().forEach((t) => t.stop());
      if (live.current === stream) live.current = null;
    };
  }, [request]);

  useEffect(() => {
    if (video.current && live.current && video.current.srcObject !== live.current) video.current.srcObject = live.current;
  }, [active, problem]);

  // While nothing could be opened, try again by itself when a camera turns up (an iPhone reconnecting).
  useEffect(() => {
    if (!problem || problem === "blocked") return;
    const md = navigator.mediaDevices;
    const retry = () => setRequest({ auto: true });
    md.addEventListener?.("devicechange", retry);
    return () => md.removeEventListener?.("devicechange", retry);
  }, [problem]);

  function retry() {
    setProblem(null);
    setReady(false);
    setActive(null);
    setNotice(null);
    setRequest({ auto: true });
  }

  /** `remember`: a pick from the menu becomes the default next time; a quick flip doesn't. */
  function choose(next: CameraRequest, remember = true) {
    setProblem(null);
    setReady(false);
    setActive(null);
    setNotice(null);
    setRequest(next);
    if (remember && "deviceId" in next) rememberCamera(next.deviceId);
  }

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d")!;
    if (active?.mirror) {
      // Keep the photo the way it looked on screen (a mirror).
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    // Lossless here: the photo is compressed once, after cropping.
    canvas.toBlob((blob) => blob && onCapture(blob), "image/png");
  }

  // Phones and tablets report which way the camera faces, so they get a one-tap flip.
  const canFlip = Boolean(active?.facing) && cameras.length > 1;
  const listed = cameras.some((c) => c.deviceId === active?.id);
  const overlay = !ready
    ? stuck === "no-picture"
      ? "This camera isn’t sending a picture. Choose another camera above."
      : "Starting your camera…"
    : stuck === "paused"
      ? "This camera is paused. Resume it, or choose another camera above."
      : null;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-3xl leading-none">Take a photo</h2>
      {cameras.length > 1 || (problem && cameras.length > 0) ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Camera</span>
          <select
            value={listed ? active?.id : ""}
            onChange={(e) => e.target.value && choose({ deviceId: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-text outline-none focus:border-text/40 focus:ring-4 focus:ring-highlight/20"
          >
            {listed ? null : <option value="">{active || problem ? "Choose a camera…" : "Starting…"}</option>}
            {cameras.map((c, i) => (
              <option key={c.deviceId} value={c.deviceId}>
                {cameraName(c, i)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {notice ? <p className="-mt-2 text-sm text-muted">{notice}</p> : null}
      {problem ? (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-surface p-4 text-sm text-muted">
          <p>
            {problem === "blocked"
              ? "Booksyde doesn’t have permission to use your camera. Allow it in your browser’s site settings (or System Settings → Privacy & Security → Camera on a Mac), then try again."
              : problem === "busy"
                ? "Your camera is busy in another app, or still waking up. Close it there and try again."
                : cameras.length
                  ? "We couldn’t open your camera. If you just disconnected your iPhone, give it a moment and try again."
                  : "We couldn’t find a camera. Connect one and try again, or upload a photo instead."}
          </p>
          <button type="button" onClick={retry} className="rounded-full border border-border px-4 py-2 font-semibold text-text hover:border-text/40">
            Try again
          </button>
        </div>
      ) : (
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl bg-ink">
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            onLoadedData={() => {
              setReady(true);
              setStuck((st) => (st === "no-picture" ? null : st));
            }}
            className={`size-full object-cover ${active?.mirror === false ? "" : "-scale-x-100"}`}
          />
          {/* Where the circle will be. */}
          <div aria-hidden className="pointer-events-none absolute inset-[8%] rounded-full shadow-[0_0_0_999px_rgba(31,27,22,0.45)] ring-2 ring-paper/80" />
          {overlay ? (
            <p role="status" className="absolute inset-0 grid place-items-center bg-ink/40 px-10 text-center text-sm text-paper/90">
              {overlay}
            </p>
          ) : null}
          {canFlip ? (
            <button
              type="button"
              onClick={() =>
                choose(
                  active?.facing === "environment" ? { auto: true } : { deviceId: cameras.find((c) => c.deviceId !== active?.id)!.deviceId },
                  false,
                )
              }
              aria-label={active?.facing === "environment" ? "Switch to the front camera" : "Switch to the back camera"}
              className="absolute bottom-3 right-3 grid size-11 place-items-center rounded-full bg-ink/60 text-paper backdrop-blur transition hover:bg-ink/80"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7h-3l-2-3H9L7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" />
                <path d="M9 13a3 3 0 0 1 5.2-2M15 13a3 3 0 0 1-5.2 2" />
                <path d="M14 9.5V11h-1.5M10 16.5V15h1.5" />
              </svg>
            </button>
          ) : null}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 font-semibold text-muted hover:text-text">
          Cancel
        </button>
        {problem ? null : (
          <button
            type="button"
            onClick={capture}
            disabled={!ready || stuck !== null}
            className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-60"
          >
            Take photo
          </button>
        )}
      </div>
    </div>
  );
}

function squareCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/**
 * Crop at full resolution, then shrink to AVATAR_SIZE by halves. One big jump (say 1080px → 512px)
 * blurs and loses detail; halving keeps it sharp.
 */
function renderAvatar(image: HTMLImageElement, sx: number, sy: number, side: number) {
  let size = Math.max(AVATAR_SIZE, Math.round(side));
  let { canvas, ctx } = squareCanvas(size);
  ctx.fillStyle = "#FBF5E8"; // behind transparent PNGs
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  while (size / 2 >= AVATAR_SIZE) {
    const next = squareCanvas(Math.round(size / 2));
    next.ctx.drawImage(canvas, 0, 0, next.canvas.width, next.canvas.height);
    ({ canvas, ctx } = next);
    size = canvas.width;
  }
  if (size === AVATAR_SIZE) return canvas;
  const out = squareCanvas(AVATAR_SIZE);
  out.ctx.drawImage(canvas, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  return out.canvas;
}

/**
 * Brighten and add contrast with the same maths as CSS `brightness()` then `contrast()`
 * (each step clamped), so the saved photo matches the preview exactly.
 */
function applyTone(canvas: HTMLCanvasElement, brightness: number, contrast: number) {
  if (brightness === 1 && contrast === 1) return canvas;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const lookup = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const lit = Math.min(1, (i / 255) * brightness);
    lookup[i] = Math.round(Math.min(1, Math.max(0, (lit - 0.5) * contrast + 0.5)) * 255);
  }
  const d = pixels.data;
  for (let p = 0; p < d.length; p += 4) {
    d[p] = lookup[d[p]];
    d[p + 1] = lookup[d[p + 1]];
    d[p + 2] = lookup[d[p + 2]];
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function CropStep({
  image,
  busy,
  error,
  onSave,
  onCancel,
}: {
  image: HTMLImageElement;
  busy: boolean;
  error: string | null;
  onSave: (photo: Blob) => void;
  onCancel: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const toned = brightness !== 1 || contrast !== 1;
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);

  // At zoom 1 the image just covers the circle; `offset` moves its centre.
  const base = Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight);
  const w = image.naturalWidth * base * zoom;
  const h = image.naturalHeight * base * zoom;
  const clamp = (o: { x: number; y: number }, ww = w, hh = h) => ({
    x: Math.max(-(ww - VIEW) / 2, Math.min((ww - VIEW) / 2, o.x)),
    y: Math.max(-(hh - VIEW) / 2, Math.min((hh - VIEW) / 2, o.y)),
  });

  function setZoomKeepingFit(z: number) {
    const next = Math.max(1, Math.min(4, z));
    setZoom(next);
    setOffset((o) => clamp(o, image.naturalWidth * base * next, image.naturalHeight * base * next));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 30 : 8;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setOffset((o) => clamp({ x: o.x + m[0], y: o.y + m[1] }));
  }

  function confirm() {
    // The circle, in the photo's own pixels.
    const perPixel = image.naturalWidth / w;
    const side = VIEW * perPixel;
    const sx = (w / 2 - VIEW / 2 - offset.x) * perPixel;
    const sy = (h / 2 - VIEW / 2 - offset.y) * perPixel;
    applyTone(renderAvatar(image, sx, sy, side), brightness, contrast).toBlob((blob) => blob && onSave(blob), "image/jpeg", 0.9);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-3xl leading-none">Frame your photo</h2>
        <p className="mt-1.5 text-sm text-muted">Drag to move it. Zoom in, and brighten it if it’s a little dark.</p>
      </div>
      <div
        role="img"
        aria-label="Photo preview. Use the arrow keys to move it."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => setZoomKeepingFit(zoom - e.deltaY / 400)}
        onKeyDown={onKeyDown}
        className="relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-xl bg-ink outline-none focus-visible:ring-4 focus-visible:ring-highlight/40 active:cursor-grabbing"
        style={{ width: VIEW, height: VIEW, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob being cropped */}
        <img
          src={image.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            width: w,
            height: h,
            left: VIEW / 2 + offset.x - w / 2,
            top: VIEW / 2 + offset.y - h / 2,
            filter: toned ? `brightness(${brightness}) contrast(${contrast})` : undefined,
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(31,27,22,0.55)] ring-2 ring-paper/80" />
      </div>
      <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2.5 text-sm text-muted">
        <Slider label="Zoom" min={1} max={4} value={zoom} onChange={setZoomKeepingFit} />
        <Slider label="Brightness" min={0.6} max={1.6} value={brightness} onChange={setBrightness} />
        <Slider label="Contrast" min={0.6} max={1.6} value={contrast} onChange={setContrast} />
        {toned ? (
          <button
            type="button"
            onClick={() => (setBrightness(1), setContrast(1))}
            className="col-start-2 justify-self-start text-xs font-semibold text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Reset brightness and contrast
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-full px-5 py-2.5 font-semibold text-muted hover:text-text">
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Use this photo"}
        </button>
      </div>
    </div>
  );
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="contents">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--bk-primary)]"
      />
    </label>
  );
}
