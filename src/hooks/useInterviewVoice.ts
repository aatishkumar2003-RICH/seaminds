import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface RecognitionEvent { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

/** autoStopMs: stop listening after this much silence. onEnd: fires once after any pending words are flushed. */
export interface VoiceOptions { autoStopMs?: number; onEnd?: () => void }

export function useInterviewVoice(locale: string, onTranscript: (text: string) => void, options: VoiceOptions = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  const opts = useRef(options);
  opts.current = options;
  const pending = useRef("");
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const w = window as VoiceWindow;
  const supported = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  const canSpeak = "speechSynthesis" in window;

  const clearSilence = () => { if (silence.current) { clearTimeout(silence.current); silence.current = null; } };
  const stop = () => { clearSilence(); try { recognition.current?.stop(); } catch { /* already stopped */ } setListening(false); setInterim(""); };
  const stopSpeaking = () => { if (canSpeak) window.speechSynthesis.cancel(); setSpeaking(false); };
  useEffect(() => {
    return () => {
      clearSilence();
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onend = null;
        recognition.current.onerror = null;
        recognition.current.abort();
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  const start = () => {
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) return;
    stopSpeaking();
    if (recognition.current) { recognition.current.onend = null; recognition.current.onresult = null; recognition.current.onerror = null; try { recognition.current.abort(); } catch { /* noop */ } }
    pending.current = "";
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const r = new Constructor();
    // iOS Safari's continuous mode drops/duplicates phrases; single-utterance mode is reliable there.
    r.lang = locale; r.continuous = !isIOS; r.interimResults = true;
    let heard = false;
    const armSilence = () => {
      const ms = opts.current.autoStopMs;
      if (!ms) return;
      clearSilence();
      // Give the speaker time to start talking; only use the short pause once words arrive.
      silence.current = setTimeout(() => { try { r.stop(); } catch { /* noop */ } }, heard ? ms : Math.max(ms, 7000));
    };
    r.onresult = (event) => {
      // Rebuild the whole transcript every event — immune to resultIndex quirks on iOS/Android.
      let full = "";
      let live = "";
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        full += `${t} `;
        if (!event.results[i].isFinal) live += t;
      }
      pending.current = full.trim();
      if (pending.current) heard = true;
      setInterim(live);
      armSilence();
    };
    let ended = false;
    const finish = () => {
      if (ended) return; ended = true;
      clearSilence();
      const left = pending.current.trim();
      pending.current = "";
      if (left) callback.current(left);
      setListening(false); setInterim("");
      opts.current.onEnd?.();
    };
    r.onend = finish;
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") { finish(); return; }
      toast.error(e.error === "not-allowed" ? "Microphone permission was denied. You can type your answer." : "Voice input stopped. You can continue by typing.");
      finish();
    };
    recognition.current = r;
    try { r.start(); setListening(true); armSilence(); } catch { toast.error("Voice input is unavailable. Please type your answer."); }
  };
  const speak = (text: string) => {
    if (!canSpeak) return;
    stop(); stopSpeaking();
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.toLowerCase() === locale.toLowerCase()) || voices.find(v => v.lang.split("-")[0] === locale.split("-")[0]);
    if (voices.length && !voice) { toast.info("No voice is installed for this language. Read the question on screen."); return; }
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = locale;
    if (voice) speech.voice = voice;
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => { setSpeaking(false); toast.info("Audio playback is unavailable. The question remains on screen."); };
    setSpeaking(true); window.speechSynthesis.speak(speech);
  };
  return { supported, canSpeak, listening, speaking, interim, start, stop, speak, stopSpeaking };
}
