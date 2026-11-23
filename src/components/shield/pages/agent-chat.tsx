"use client";

// ShieldAgent chat — the citizen-facing AI assistant. Every reply is labeled
// live-AI or rule-based fallback (never faked); guidance is grounded in the
// same safety doctrine as the analysis pipeline.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Send, Loader2, User, ShieldQuestion, ChevronDown, ChevronRight, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ShieldApiError } from "../api";
import { useLang } from "../i18n";
import { CHAT_MODEL_CATALOG } from "@/lib/chat-models";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  engine?: string; // assistant messages
  servedModel?: string | null; // OpenRouter model that served the reply
}

const QUICK_PROMPTS = [
  {
    bn: "এই মেসেজটা কি প্রতারণা? “আপনার বিকাশ একাউন্ট সাসপেন্ড হবে, ওটিপি দিন”",
    en: "Is this a scam? “Your bKash account will be suspended, send the OTP”",
  },
  {
    bn: "ভুয়া চাকরির বিজ্ঞপ্তি চেনার উপায় কী?",
    en: "How do I recognize fake job circulars?",
  },
  {
    bn: "টাকা পাঠিয়ে ফেলেছি — এখন কী করবো?",
    en: "I already sent money — what should I do now?",
  },
  {
    bn: "বাবা-মাকে সতর্ক করার সহজ উপায় বলুন",
    en: "Easy ways to warn my parents about scams",
  },
];

const MODEL_STORAGE_KEY = "banglashield.chat.model";

export function AgentChat({ compact = false }: { compact?: boolean }) {
  const bn = useLang() === "bn";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [howOpen, setHowOpen] = useState(false);
  const [model, setModel] = useState<string>("auto");

  // Restore the user's last model selection.
  useEffect(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved && (saved === "auto" || CHAT_MODEL_CATALOG.some((m) => m.id === saved))) {
      setModel(saved);
    }
  }, []);

  const pickModel = (id: string) => {
    setModel(id);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, id);
    } catch {
      /* private mode — selection still applies for this session */
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await api.post<{
        reply: string;
        engine: string;
        note: { bn: string; en: string } | null;
        servedModel?: string | null;
      }>("/api/v1/agent/chat", {
        messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        model: model === "auto" ? undefined : model,
      });
      setMessages([...next, { role: "assistant", content: res.reply, engine: res.engine, servedModel: res.servedModel }]);
      if (res.engine === "rule-based-fallback") {
        toast.info(bn ? "লাইভ এআই এখন অফলাইন — নিয়মভিত্তিক উত্তর দেওয়া হলো (লেবেলকৃত)" : "Live AI offline — labeled rule-based reply given");
      }
    } catch (err) {
      if (err instanceof ShieldApiError) toast.error(err.apiError.message);
      else toast.error(bn ? "নেটওয়ার্ক সমস্যা" : "Network problem");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className={cn("p-4 md:p-5", compact && "p-4")}>
          {/* chat header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="flex items-center gap-2 font-bold text-[#202C26] bn-text">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F5746]">
                <Bot className="h-5 w-5 text-[#DDE8DF]" aria-hidden />
              </span>
              {bn ? "শিল্ডএজেন্ট — এআই সহকারী" : "ShieldAgent — AI assistant"}
            </p>
            <Badge variant="outline" className="border-[#2F5746]/40 text-[#2F5746] text-[11px] bn-text">
              {bn ? "সচেতনতা-সহায়তা · ব্যাংক/পুলিশ নয়" : "Awareness support · not a bank/police"}
            </Badge>
          </div>

          {/* model selection — every reply labels the model that served it */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#59665F] bn-text">
              <Cpu className="h-3.5 w-3.5" aria-hidden />
              {bn ? "এআই মডেল:" : "AI model:"}
            </span>
            <Select value={model} onValueChange={pickModel}>
              <SelectTrigger
                className="h-8 w-auto min-w-[190px] border-[#2F5746]/40 bg-[#FFFEFA] text-[13px] text-[#2F5746] focus:ring-[#2F5746]"
                aria-label={bn ? "চ্যাট মডেল নির্বাচন" : "Chat model selection"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                <SelectItem value="auto" className="text-[13px]">
                  {bn ? "স্বয়ংক্রিয় (প্রস্তাবিত)" : "Auto (recommended)"}
                </SelectItem>
                {CHAT_MODEL_CATALOG.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-[13px]">
                    <span className="flex flex-col items-start py-0.5">
                      <span className="font-semibold bn-text">{bn ? m.labelBn : m.label}</span>
                      <span className="text-[11px] text-[#8A9B90]">{m.note}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {model !== "auto" && (
              <Badge variant="outline" className="border-[#8A5B28]/40 text-[#8A5B28] text-[10px]">
                {bn ? "আপনি বেছে নিয়েছেন" : "your pick"}
              </Badge>
            )}
          </div>

          <p className="mt-2 text-sm text-[#59665F] bn-text">
            {bn
              ? "প্রতারণা নিয়ে যেকোনো প্রশ্ন করুন — বাংলা বা ইংরেজি। সতর্কতা: এআই ভুল করতে পারে; গুরুত্বপূর্ণ সিদ্ধান্ত নিজে যাচাই করে নিন।"
              : "Ask anything about scams — Bangla or English. Caution: AI can be wrong; verify important decisions yourself."}
          </p>

          {/* messages */}
          <div
            ref={scrollRef}
            className={cn("mt-4 space-y-3 overflow-y-auto pr-1", compact ? "max-h-80" : "max-h-96")}
            aria-live="polite"
            aria-label={bn ? "কথোপকথন" : "Conversation"}
          >
            {messages.length === 0 && !busy && (
              <div className="rounded-xl border border-dashed border-[#D8DED5] bg-[#F4F1EB] p-4 space-y-2.5">
                <p className="text-xs font-bold text-[#59665F] bn-text">{bn ? "দিয়ে শুরু করতে পারেন:" : "Try starting with:"}</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => send(bn ? q.bn : q.en)}
                      className="rounded-full border border-[#2F5746]/30 bg-[#FFFEFA] px-3 py-2 text-left text-[13px] font-medium text-[#2F5746] hover:bg-[#DDE8DF] transition-colors focus-ring bn-text"
                    >
                      {bn ? q.bn : q.en}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex items-start gap-2.5", m.role === "user" && "justify-end")}>
                {m.role === "assistant" && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2F5746]">
                    <Bot className="h-4 w-4 text-[#DDE8DF]" aria-hidden />
                  </span>
                )}
                <div className={cn("max-w-[85%]", m.role === "user" && "flex flex-col items-end")}>
                  <div
                    className={cn(
                      "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bn-text",
                      m.role === "user"
                        ? "bg-[#2F5746] text-[#FFFEFA]"
                        : "bg-[#F4F1EB] border border-[#D8DED5] text-[#202C26]"
                    )}
                  >
                    {m.content}
                  </div>
                  {m.role === "assistant" && m.engine && (
                    <p className="mt-1 text-[10px] text-[#8A9B90] bn-text">
                      {m.engine === "live-ai"
                        ? `${bn ? "লাইভ এআই উত্তর" : "Live AI reply"}${m.servedModel ? ` · ${m.servedModel}` : ""}`
                        : bn ? "নিয়মভিত্তিক ফলব্যাক (লাইভ এআই নয়)" : "Rule-based fallback (not live AI)"}
                    </p>
                  )}
                </div>
                {m.role === "user" && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8A9B90]">
                    <User className="h-4 w-4 text-[#FFFEFA]" aria-hidden />
                  </span>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2F5746]">
                  <Bot className="h-4 w-4 text-[#DDE8DF]" aria-hidden />
                </span>
                <div className="rounded-xl bg-[#F4F1EB] border border-[#D8DED5] px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2F5746]" aria-hidden />
                  <span className="text-sm text-[#59665F] bn-text">{bn ? "ভাবছি…" : "Thinking…"}</span>
                </div>
              </div>
            )}
          </div>

          {/* input */}
          <div className="mt-4 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder={bn ? "আপনার প্রশ্ন লিখুন… (Enter চাপলে পাঠাবে)" : "Type your question… (Enter to send)"}
              className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] bn-text"
              aria-label={bn ? "শিল্ডএজেন্টকে বার্তা" : "Message to ShieldAgent"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button
              onClick={() => send(input)}
              disabled={busy || input.trim().length < 2}
              size="icon"
              className="h-11 w-11 shrink-0 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A]"
              aria-label={bn ? "পাঠান" : "Send"}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* how the agent works (task: clearly defined role & workflow) */}
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-4 md:p-5">
          <button
            onClick={() => setHowOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left focus-ring rounded"
            aria-expanded={howOpen}
          >
            <span className="flex items-center gap-2 font-bold text-[#202C26] bn-text">
              <ShieldQuestion className="h-5 w-5 text-[#2F5746]" aria-hidden />
              {bn ? "শিল্ডএজেন্ট কীভাবে কাজ করে" : "How ShieldAgent works"}
            </span>
            {howOpen ? <ChevronDown className="h-5 w-5 text-[#59665F]" aria-hidden /> : <ChevronRight className="h-5 w-5 text-[#59665F]" aria-hidden />}
          </button>
          {howOpen && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-bold text-[#202C26] bn-text">{bn ? "এজেন্টের ভূমিকা" : "The agent's role"}</p>
                <ul className="mt-1.5 space-y-1.5 text-sm text-[#59665F] leading-relaxed bn-text">
                  {(bn
                    ? [
                        "ব্যাখ্যা করা — পাওয়া বার্তা/কল কেন সন্দেহজনক হতে পারে",
                        "পরামর্শ দেওয়া — এখন কী করতে হবে (নিরাপদ ডিফল্ট: থামুন → যাচাই করুন)",
                        "শেখানো — কমন কৌশলগুলো চেনা ও এড়ানো",
                      ]
                    : [
                        "Explain — why a message/call may be suspicious",
                        "Advise — what to do now (safe default: pause → verify)",
                        "Teach — recognize and avoid common tactics",
                      ]
                  ).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#2F5746] font-bold" aria-hidden>•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-bold text-[#202C26] bn-text">{bn ? "কাজের ধারা (৫ ধাপ)" : "Workflow (5 steps)"}</p>
                <ol className="mt-1.5 space-y-1.5 text-sm text-[#59665F] leading-relaxed bn-text">
                  {(bn
                    ? [
                        "আপনার প্রশ্ন ও শেয়ার করা লেখা অবিশ্বস্ত তথ্য হিসেবে গৃহীত হয় — নির্দেশনা হিসেবে নয়",
                        "নিয়ম-ইঞ্জিন আগে নির্ভরযোগ্য সংকেতগুলো বের করে (ওটিপি চাওয়া, ভয় দেখানো, ছদ্মবেশ…)",
                        "এআই মডেল সেই সংকেতের ভিত্তিতে সহজ ভাষায় ব্যাখ্যা তৈরি করে",
                        "নিরাপত্তা-নিয়ম যাচাই করা হয়: কোনো বানানো নম্বর/ঠিকানা নয়, কোনো কোড চাওয়া নয়, নিশ্চয়তা নয়",
                        "উত্তরে লেবেল থাকে — লাইভ এআই নাকি ফলব্যাক, সবসময় স্পষ্ট লেখা থাকে",
                      ]
                    : [
                        "Your question and any shared text are treated as untrusted data — never as instructions",
                        "The rule engine first extracts reliable signals (OTP requests, fear tactics, impersonation…)",
                        "The AI model builds a plain-language explanation grounded in those signals",
                        "Safety rules are enforced: no invented contacts, no code requests, no guarantees",
                        "Every reply is labeled — live AI or fallback, always visibly stated",
                      ]
                  ).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F5746] text-[10px] font-bold text-[#FFFEFA]" aria-hidden>
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-sm font-bold text-[#202C26] bn-text">{bn ? "এজেন্ট যা করে না" : "What the agent never does"}</p>
                <ul className="mt-1.5 space-y-1.5 text-sm text-[#59665F] leading-relaxed bn-text">
                  {(bn
                    ? [
                        "কখনোই ওটিপি/পিন/পাসওয়ার্ড চায় না বা গ্রহণ করে না",
                        "বার্তায় আসা নম্বর বা লিংক ‘আসল’ বলে সাজায় না",
                        "“১০০% নিরাপদ” বলে না — নিজে যাচাই করতে বলে",
                        "টাকা, ফি বা রেফান্ড নিয়ে কোনো লেনদেন করে না",
                      ]
                    : [
                        "Never asks for or accepts OTPs, PINs or passwords",
                        "Never presents numbers or links from your message as official",
                        "Never says \"100% safe\" — always advises independent verification",
                        "Never handles money, fees or refunds",
                      ]
                  ).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#A44435] font-bold" aria-hidden>✕</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-[#8A9B90] bn-text">
                {bn
                  ? "কথোপকথন সার্ভারে সংরক্ষণ করা হয় না — ব্রাউজার বন্ধ করলেই মুছে যায়।"
                  : "Conversations are not stored on the server — they disappear when you close the browser."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
