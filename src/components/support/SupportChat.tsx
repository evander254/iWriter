import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { Avatar, Button, Loading } from "../common";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { supabase } from "../../lib/supabase";
import { getSignedUrl } from "../../services/storage";
import { getOrCreateSupportConversation, listSupportConversations, listSupportMessages, sendSupportMessage, type SupportConversation, type SupportMessage } from "../../services/support";
import { formatRelative } from "../../utils/date";

interface PresenceUser { user_id: string; role: "admin" | "writer" }

export function SupportChat() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.role === "admin";
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const rows = await listSupportConversations();
      setConversations(rows);
      setConversation((selected) => selected ? rows.find((item) => item.id === selected.id) ?? selected : rows[0] ?? null);
    } catch (error) {
      toast.error("Could not load support inbox", error instanceof Error ? error.message : undefined);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        if (isAdmin) {
          const rows = await listSupportConversations();
          if (cancelled) return;
          setConversations(rows);
          setConversation((selected) => selected ? rows.find((item) => item.id === selected.id) ?? selected : rows[0] ?? null);
        } else {
          const row = await getOrCreateSupportConversation(user.id);
          if (cancelled) return;
          setConversation(row);
        }
      } catch (error) {
        if (!cancelled) toast.error("Could not open support chat", error instanceof Error ? error.message : undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id, isAdmin, toast]);

  const refreshMessages = useCallback(async () => {
    if (!conversation) { setMessages([]); return; }
    try {
      const rows = await listSupportMessages(conversation.id, isAdmin);
      setMessages(rows);
      const paths = [...new Set(rows.flatMap((message) => message.attachments.map((attachment) => attachment.path)))];
      const pairs = await Promise.all(paths.map(async (path) => [path, await getSignedUrl(path, 3600, "support-attachments")] as const));
      setAttachmentUrls(Object.fromEntries(pairs.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
      requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; });
    } catch (error) {
      toast.error("Could not load messages", error instanceof Error ? error.message : undefined);
    }
  }, [conversation?.id, isAdmin, toast]);

  useEffect(() => {
    if (!open || !conversation || !user) return;
    void refreshMessages();
    const channel = supabase.channel(`support-${conversation.id}`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    });
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conversation.id}` }, () => {
        void refreshMessages();
        if (isAdmin) void loadConversations();
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        setOnlineIds(new Set(Object.values(state).flatMap((entries) => entries.map((entry) => entry.user_id))));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if ((payload as { user_id?: string }).user_id === user.id) return;
        setTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(false), 2200);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ user_id: user.id, role: isAdmin ? "admin" : "writer" });
      });
    channelRef.current = channel;
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [open, conversation?.id, user?.id, isAdmin, refreshMessages, loadConversations]);

  const otherOnline = useMemo(() => isAdmin
    ? Boolean(conversation && onlineIds.has(conversation.writer_id))
    : [...onlineIds].some((id) => id !== user?.id), [isAdmin, conversation?.writer_id, onlineIds, user?.id]);

  const send = async () => {
    if (!user || !conversation || sending || (!body.trim() && files.length === 0)) return;
    setSending(true);
    try {
      await sendSupportMessage({ conversationId: conversation.id, senderId: user.id, body, files });
      setBody("");
      setFiles([]);
      const input = document.getElementById("support-chat-files") as HTMLInputElement | null;
      if (input) input.value = "";
      await refreshMessages();
    } catch (error) {
      toast.error("Message could not be sent", error instanceof Error ? error.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const notifyTyping = (value: string) => {
    setBody(value);
    if (value && channelRef.current) void channelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user?.id } });
  };

  const writer = conversation?.writer;

  return (
    <div className="iw-support">
      {open && <section className="iw-support__panel" aria-label="Support chat">
        <header className="iw-support__header">
          <div className="iw-support__header-title">
            <strong>{isAdmin ? "Writer support inbox" : "Chat with support"}</strong>
            <span className="iw-support__status"><i className={otherOnline ? "is-online" : ""} />{otherOnline ? (isAdmin ? "Writer online" : "Support online") : "Typically replies soon"}</span>
          </div>
          <button type="button" className="iw-support__close" onClick={() => setOpen(false)} aria-label="Close support chat"><X size={19} /></button>
        </header>

        {isAdmin && <div className="iw-support__threads" aria-label="Support conversations">
          {conversations.length === 0 ? <span>No writer conversations yet.</span> : conversations.map((item) => (
            <button type="button" key={item.id} className={conversation?.id === item.id ? "is-active" : ""} onClick={() => setConversation(item)}>
              <Avatar name={item.writer?.full_name} size="sm" />
              <span><strong>{item.writer?.full_name || "Writer"}</strong><small>{item.writer?.email ?? "Writer support"}</small></span>
              <i className={onlineIds.has(item.writer_id) ? "is-online" : ""} />
            </button>
          ))}
        </div>}

        {loading ? <div className="iw-support__loading"><Loading label="Opening chat…" /></div> : !conversation ? (
          <div className="iw-support__empty">Start a conversation by sending a message.</div>
        ) : <>
          <div className="iw-support__messages" ref={listRef} aria-live="polite">
            {messages.length === 0 ? <div className="iw-support__empty">{isAdmin ? "No messages yet. Reply to help this writer." : "Welcome! Send us a message and our team will help."}</div> : messages.map((message) => {
              const own = message.sender_id === user?.id;
              const label = isAdmin
                ? `${own ? (profile?.full_name ?? "Admin") : (message.sender?.full_name ?? writer?.full_name ?? "Writer")} · ${own ? "Administrator" : (message.sender?.role === "admin" ? "Administrator" : "Writer")}`
                : (own ? "You" : "Support team");
              return <article key={message.id} className={`iw-support__message ${own ? "is-own" : ""}`}>
                <div className="iw-support__message-meta"><strong>{label}</strong><time>{formatRelative(message.created_at)}</time></div>
                {message.body && <p>{message.body}</p>}
                {message.attachments.map((attachment) => <a key={attachment.path} href={attachmentUrls[attachment.path]} target="_blank" rel="noreferrer" className="iw-support__attachment"><Paperclip size={14} />{attachment.name}</a>)}
              </article>;
            })}
            {typing && <div className="iw-support__typing">{isAdmin ? `${writer?.full_name ?? "Writer"} is typing` : "Support is typing"}<span>…</span></div>}
          </div>
          <form className="iw-support__composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            {files.length > 0 && <div className="iw-support__file-list">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}><X size={13} /></button></span>)}</div>}
            <textarea value={body} onChange={(event) => notifyTyping(event.target.value)} placeholder="Write a message…" rows={2} aria-label="Message" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} />
            <div className="iw-support__composer-actions">
              <label className="iw-support__attach" htmlFor="support-chat-files" title="Attach up to 5 files"><Paperclip size={17} /><span>Attach</span></label>
              <input id="support-chat-files" type="file" multiple onChange={(event) => {
                const chosen = Array.from(event.target.files ?? []);
                setFiles((current) => [...current, ...chosen].slice(0, 5));
              }} />
              <small>Up to 5 files · 25 MB each</small>
              <Button variant="primary" size="sm" icon={Send} loading={sending} disabled={sending || (!body.trim() && files.length === 0)}>Send</Button>
            </div>
          </form>
        </>}
      </section>}

      <button type="button" className="iw-support__launcher" aria-label={open ? "Close support chat" : "Open support chat"} onClick={() => {
        setOpen((value) => !value);
        if (isAdmin) void loadConversations();
      }}>
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && <span>Support</span>}
      </button>
    </div>
  );
}
