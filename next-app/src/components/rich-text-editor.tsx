"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Undo,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your grievance description…",
  minHeight = "10rem",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate({ editor: current }) {
      onChange(current.getHTML());
    },
  });

  if (!editor) {
    return (
      <div
        className="rounded-lg border border-input bg-white"
        style={{ minHeight }}
      />
    );
  }

  const button = (
    active: boolean,
    on: boolean,
    disabled: boolean,
    onClick: () => void,
    label: string,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        on && "bg-secondary text-secondary-foreground",
        active && "pointer-events-none opacity-40",
      )}
    >
      {icon}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        {button(
          false,
          editor.isActive("bold"),
          !editor.can().chain().focus().toggleBold().run(),
          () => editor.chain().focus().toggleBold().run(),
          "Bold",
          <Bold className="h-4 w-4" />,
        )}
        {button(
          false,
          editor.isActive("italic"),
          !editor.can().chain().focus().toggleItalic().run(),
          () => editor.chain().focus().toggleItalic().run(),
          "Italic",
          <Italic className="h-4 w-4" />,
        )}
        {button(
          false,
          editor.isActive("heading", { level: 2 }),
          false,
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          "Heading",
          <Heading2 className="h-4 w-4" />,
        )}
        {button(
          false,
          editor.isActive("bulletList"),
          false,
          () => editor.chain().focus().toggleBulletList().run(),
          "Bulleted list",
          <List className="h-4 w-4" />,
        )}
        {button(
          false,
          editor.isActive("orderedList"),
          false,
          () => editor.chain().focus().toggleOrderedList().run(),
          "Numbered list",
          <ListOrdered className="h-4 w-4" />,
        )}
        {button(
          false,
          editor.isActive("blockquote"),
          false,
          () => editor.chain().focus().toggleBlockquote().run(),
          "Quote",
          <Quote className="h-4 w-4" />,
        )}
        {button(
          false,
          editor.isActive("codeBlock"),
          false,
          () => editor.chain().focus().toggleCodeBlock().run(),
          "Code",
          <Code className="h-4 w-4" />,
        )}
        {button(
          false,
          editor.isActive("horizontalRule"),
          false,
          () => editor.chain().focus().setHorizontalRule().run(),
          "Divider",
          <Minus className="h-4 w-4" />,
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        {button(
          false,
          false,
          !editor.can().chain().focus().undo().run(),
          () => editor.chain().focus().undo().run(),
          "Undo",
          <Undo className="h-4 w-4" />,
        )}
        {button(
          false,
          false,
          !editor.can().chain().focus().redo().run(),
          () => editor.chain().focus().redo().run(),
          "Redo",
          <Redo className="h-4 w-4" />,
        )}
      </div>
      <EditorContent
        editor={editor}
        className="px-4 py-3 prose prose-sm prose-primary max-w-none prose-headings:font-semibold"
        style={{ minHeight }}
      />
    </div>
  );
}
