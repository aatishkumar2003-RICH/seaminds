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

export function useInterviewVoice(locale: string, onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  const w = window as VoiceWindow;
  const supported = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  const canSpeak = "speechSynthesis" in window;

  const stop = () => { recognition.current?.stop(); setListening(false); setInterim(""); };
  const stopSpeaking = () => { if (canSpeak) window.speechSynthesis.cancel(); setSpeaking(false); };
  useEffect(() => {
    return () => {
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
    const r = new Constructor();
    r.lang = locale; r.continuous = true; r.interimResults = true;
    r.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) callback.current(result[0].transcript);
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    r.onend = () => { setListening(false); setInterim(""); };
    r.onerror = (e) => {
      setListening(false); setInterim("");
      toast.error(e.error === "not-allowed" ? "Microphone permission was denied. You can type your answer." : "Voice input stopped. You can continue by typing.");
    };
    recognition.current = r;
    try { r.start(); setListening(true); } catch { toast.error("Voice input is unavailable. Please type your answer."); }
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