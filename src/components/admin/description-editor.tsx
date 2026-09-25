"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, RemoveFormatting } from "lucide-react";
import { looksLikeHtml, plainTextToHtml } from "@/lib/description-html";
import { useDirtySignal } from "@/components/admin/use-dirty-signal";

// Ürün açıklaması için küçük zengin metin editörü. Düz <textarea> yapıştırılan metnin
// kalın/liste biçimini atıyordu; TipTap bunları korur. Değer gizli input ile forma
// HTML olarak gider, sunucu kayıttan önce sanitizeDescriptionHtml ile temizler.
export function DescriptionEditor({
  name,
  defaultValue,
  required
}: {
  name: string;
  defaultValue: string;
  required?: boolean;
}) {
  const [initialContent] = useState(() => (looksLikeHtml(defaultValue) ? defaultValue : plainTextToHtml(defaultValue)));
  const [html, setHtml] = useState(initialContent);
  const [error, setError] = useState(false);
  const inputRef = useDirtySignal(html);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        link: false
      })
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] max-h-[520px] overflow-y-auto px-4 py-2.5 text-sm leading-relaxed focus:outline-none [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      },
      // Heading kapalı; yapıştırılan başlıklar kalın paragraf olarak gelsin.
      transformPastedHTML: (pasted) =>
        pasted.replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, "<p><strong>$1</strong></p>")
    },
    onUpdate: ({ editor }) => {
      setHtml(editor.isEmpty ? "" : editor.getHTML());
      setError(false);
    }
  });

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false
    })
  });

  // Gizli input'ta `required` çalışmadığı için boş gönderimi burada engelliyoruz.
  useEffect(() => {
    if (!required) return;
    const form = inputRef.current?.form;
    if (!form) return;
    const handleSubmit = (e: SubmitEvent) => {
      if (inputRef.current?.value) return;
      e.preventDefault();
      setError(true);
      editor?.commands.focus();
    };
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [required, editor, inputRef]);

  const buttons = [
    { icon: Bold, label: "Kalın", isActive: active?.bold, run: () => editor?.chain().focus().toggleBold().run() },
    { icon: Italic, label: "İtalik", isActive: active?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { icon: List, label: "Madde listesi", isActive: active?.bulletList, run: () => editor?.chain().focus().toggleBulletList().run() },
    {
      icon: ListOrdered,
      label: "Numaralı liste",
      isActive: active?.orderedList,
      run: () => editor?.chain().focus().toggleOrderedList().run()
    },
    {
      icon: RemoveFormatting,
      label: "Biçimi temizle",
      isActive: false,
      run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run()
    }
  ];

  return (
    <div className="mt-1">
      <div
        className={`rounded-md border focus-within:border-admin-accent focus-within:ring-1 focus-within:ring-admin-accent ${
          error ? "border-red-500" : "border-admin-border"
        }`}
      >
        <div className="flex gap-1 border-b border-admin-border px-2 py-1.5">
          {buttons.map(({ icon: Icon, label, isActive, run }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              disabled={!editor}
              onClick={run}
              className={`rounded p-1.5 text-admin-text-muted hover:bg-admin-border/50 hover:text-admin-text ${
                isActive ? "bg-admin-border/70 text-admin-text" : ""
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        {editor ? <EditorContent editor={editor} /> : <div className="min-h-[220px]" aria-hidden />}
      </div>
      <input ref={inputRef} type="hidden" name={name} value={html} />
      {error && <p className="mt-1 text-xs text-red-600">Açıklama gerekli</p>}
    </div>
  );
}
