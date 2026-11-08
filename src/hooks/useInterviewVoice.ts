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

/**
 * autoStopMs: stop listening after this much silence. onEnd: fires once after any pending words are flushed.
 * dictation: continuous mode on every platform; the mic stays open through pauses and silently
 * reopens if the browser (iOS Safari) ends the session, until the user stops it.
 */
export interface VoiceOptions { autoStopMs?: number; onEnd?: () => void; dictation?: boolean }

const MAX_RESTARTS = 40;

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
  const userStopped = useRef(true);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const w = window as VoiceWindow;
  const supported = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  const canSpeak = "speechSynthesis" in window;

  const clearSilence = () => { if (silence.current) { clearTimeout(silence.current); silence.current = null; } };
  const detach = (r: Recognition | null) => { if (r) { r.onresult = null; r.onend = null; r.onerror = null; } };
  const stop = () => { userStopped.current = true; clearSilence(); try { recognition.current?.stop(); } catch { /* already stopped */ } setListening(false); setInterim(""); };
  const stopSpeaking = () => { if (canSpeak) window.speechSynthesis.cancel(); setSpeaking(false); };
  useEffect(() => {
    return () => {
      userStopped.current = true;
      clearSilence();
      if (recognition.current) { detach(recognition.current); try { recognition.current.abort(); } catch { /* noop */ } }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const start = () => {
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) return;
    stopSpeaking();
    if (recognition.current) { detach(recognition.current); try { recognition.current.abort(); } catch { /* noop */ } }
    pending.current = "";
    userStopped.current = false;
    const dictation = Boolean(opts.current.dictation);
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let restarts = 0;
    let heard = false;
    let ended = false;

    const flush = () => {
      const left = pending.current.trim();
      pending.current = "";
      if (left) callback.current(left);
    };
    const finish = () => {
      if (ended) return; ended = true;
      clearSilence(); flush();
      userStopped.current = true;
      setListening(false); setInterim("");
      opts.current.onEnd?.();
    };

    const open = () => {
      const r = new Constructor();
      // Dictation stays continuous everywhere; the older single-utterance path is kept for interviews on iOS.
      r.lang = locale; r.continuous = dictation || !isIOS; r.interimResults = true;
      const armSilence = () => {
        const ms = opts.current.autoStopMs;
        if (!ms || dictation) return;
        clearSilence();
        silence.current = setTimeout(() => { try { r.stop(); } catch { /* noop */ } }, heard ? ms : Math.max(ms, 7000));
      };
      r.onresult = (event) => {
        // Rebuild the whole session transcript every event — immune to resultIndex quirks on iOS/Android.
        let full = "";
        let live = "";
        for (let i = 0; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          full += `${t} `;
          if (!event.results[i].isFinal) live += t;
        }
        pending.current = full.trim();
        if (pending.current) heard = true;
        // In dictation show everything heard so far this session, so the text box fills live.
        setInterim(dictation ? pending.current : live);
        armSilence();
      };
      r.onend = () => {
        if (dictation && !userStopped.current && restarts < MAX_RESTARTS) {
          // Browser closed the mic on its own (pause/iOS). Keep the words and reopen quietly.
          flush(); setInterim("");
          restarts += 1;
          setTimeout(() => {
            if (userStopped.current || recognition.current !== r) { finish(); return; }
            try { open(); } catch { finish(); }
          }, 150);
          return;
        }
        finish();
      };
      r.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") { if (!dictation) finish(); return; }
        if (e.error === "network" && dictation) return; // onend will reopen
        userStopped.current = true;
        toast.error(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone permission was denied. You can type instead." : "Voice input stopped. You can continue by typing.");
        finish();
      };
      recognition.current = r;
      r.start();
      armSilence();
    };

    try { open(); setListening(true); } catch { userStopped.current = true; toast.error("Voice input is unavailable. Please type."); }
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
