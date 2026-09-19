"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface ParsedExpenseResult {
  amount: string;
  description: string;
  categoryId: string;
}

interface VoiceEntryButtonProps {
  onParsed: (result: ParsedExpenseResult) => void;
}

export function VoiceEntryButton({ onParsed }: VoiceEntryButtonProps) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Deliberate: browser speech-recognition support can only be detected
  // client-side; server and first client render assume supported so the
  // button doesn't flash away, then this corrects it post-hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  async function handleTranscript(text: string) {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/expenses/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't understand that. Please enter manually.");
      onParsed(body.data);
      toast.success("Filled from voice, review before saving");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice parsing failed");
    } finally {
      setParsing(false);
    }
  }

  function toggleListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      handleTranscript(transcript);
    };
    recognition.onerror = () => {
      toast.error("Couldn't hear that. Please try again or enter manually.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleListening}
      disabled={parsing}
      className="gap-1.5"
    >
      {parsing ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : listening ? (
        <MicOff className="size-4 text-destructive" aria-hidden />
      ) : (
        <Mic className="size-4" aria-hidden />
      )}
      {parsing ? "Understanding…" : listening ? "Listening… tap to stop" : "Add by voice"}
    </Button>
  );
}
