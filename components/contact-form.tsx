"use client"

import { useState } from "react"
import { Mail, Send, Loader2 } from "lucide-react"
import { siteConfig } from "@/lib/data"
import { toast } from "sonner"

export function ContactForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const endpoint = siteConfig.contactFormEndpoint?.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all fields.")
      return
    }
    setSending(true)
    try {
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
        })
        if (!res.ok) throw new Error("Send failed")
        toast.success("Message sent. We'll get back to you soon.")
        setName("")
        setEmail("")
        setMessage("")
      } else {
        const subject = encodeURIComponent(`Support: ${name.trim()}`)
        const body = encodeURIComponent(
          `Name: ${name.trim()}\nEmail: ${email.trim()}\n\nMessage:\n${message.trim()}`
        )
        window.location.href = `mailto:${siteConfig.supportEmail}?subject=${subject}&body=${body}`
        toast.success("Opening your email app. Send the message to contact support.")
      }
    } catch {
      toast.error("Something went wrong. Try emailing us directly at " + siteConfig.supportEmail)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <textarea
        placeholder="How can we help?"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      <button
        type="submit"
        disabled={sending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? "Sending…" : "Send message"}
      </button>
      {!endpoint && (
        <p className="text-xs text-muted-foreground">
          Or email us directly:{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-primary underline">
            {siteConfig.supportEmail}
          </a>
        </p>
      )}
    </form>
  )
}
