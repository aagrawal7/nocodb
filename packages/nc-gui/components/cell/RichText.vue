<script lang="ts" setup>
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import TurndownService from 'turndown'
import { marked } from 'marked'
import { generateJSON } from '@tiptap/html'
import Underline from '@tiptap/extension-underline'
import { TaskItem } from '@/helpers/dbTiptapExtensions/task-item'
import { Link } from '@/helpers/dbTiptapExtensions/links'
import { IsExpandedFormOpenInj, RowHeightInj } from '#imports'

const props = defineProps<{
  value?: string | null
  readOnly?: boolean
  syncValueChange?: boolean
  showMenu?: boolean
  fullMode?: boolean
}>()

const emits = defineEmits(['update:value'])

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const rowHeight = inject(RowHeightInj, ref(1 as const))

const turndownService = new TurndownService({})

turndownService.addRule('lineBreak', {
  filter: (node) => {
    return node.nodeName === 'BR'
  },
  replacement: () => {
    return '<br />'
  },
})

turndownService.addRule('taskList', {
  filter: (node) => {
    return node.nodeName === 'LI' && !!node.getAttribute('data-checked')
  },
  replacement: (content, node: any) => {
    // Remove the first \n\n and last \n\n
    const processContent = content.replace(/^\n\n/, '').replace(/\n\n$/, '')

    const isChecked = node.getAttribute('data-checked') === 'true'

    return `[${isChecked ? 'x' : ' '}] ${processContent}\n\n`
  },
})

turndownService.addRule('strikethrough', {
  filter: ['s'],
  replacement: (content) => {
    return `~${content}~`
  },
})

turndownService.keep(['u', 'del'])

const checkListItem = {
  name: 'checkListItem',
  level: 'block',
  tokenizer(src: string) {
    src = src.split('\n\n')[0]
    const isMatched = src.startsWith('[ ]') || src.startsWith('[x]') || src.startsWith('[X]')

    if (isMatched) {
      const isNotChecked = src.startsWith('[ ]')
      let text = src.slice(3)
      if (text[0] === ' ') text = text.slice(1)

      const token = {
        // Token to generate
        type: 'checkListItem',
        raw: src,
        text,
        tokens: [],
        checked: !isNotChecked,
      }

      ;(this as any).lexer.inline(token.text, token.tokens) // Queue this data to be processed for inline tokens
      return token
    }

    return false
  },
  renderer(token: any) {
    return `<ul data-type="taskList"><li data-checked="${
      token.checked ? 'true' : 'false'
    }" data-type="taskItem"><label><input type="checkbox" ${
      token.checked ? 'checked="checked"' : ''
    }><span></span></label><div>${(this as any).parser.parseInline(token.tokens)}</div></li></ul>` // parseInline to turn child tokens into HTML
  },
}

marked.use({ extensions: [checkListItem] })

const editorDom = ref<HTMLElement | null>(null)

const vModel = useVModel(props, 'value', emits, { defaultValue: '' })

const tiptapExtensions = [
  StarterKit,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Underline,
  Link,
]

const editor = useEditor({
  extensions: tiptapExtensions,
  onUpdate: ({ editor }) => {
    const markdown = turndownService
      .turndown(editor.getHTML().replaceAll(/<p><\/p>/g, '<br />'))
      .replaceAll(/\n\n<br \/>\n\n/g, '<br>\n\n')

    vModel.value = markdown
  },
  editable: !props.readOnly,
})

const setEditorContent = (contentMd: any, focusEndOfDoc?: boolean) => {
  if (!editor.value) return

  const selection = editor.value.view.state.selection

  const contentHtml = contentMd ? marked.parse(contentMd) : '<p></p>'

  const content = generateJSON(contentHtml, tiptapExtensions)

  editor.value.chain().setContent(content).setTextSelection(selection.to).run()

  setTimeout(() => {
    if (focusEndOfDoc) {
      const docSize = editor.value!.state.doc.nodeSize

      editor.value
        ?.chain()
        .setTextSelection(docSize - 1)
        .run()
    }

    ;(editor.value!.state as any).history$.prevRanges = null
    ;(editor.value!.state as any).history$.done.eventCount = 0
  }, 100)
}

if (props.syncValueChange) {
  watch(vModel, () => {
    setEditorContent(vModel.value)
  })
}

watch(editorDom, () => {
  if (!editorDom.value) return

  setEditorContent(vModel.value, true)

  // Focus editor after editor is mounted
  setTimeout(() => {
    editor.value?.chain().focus().run()
  }, 50)
})
</script>

<template>
  <div
    class="h-full focus:outline-none"
    :class="{
      'flex flex-col flex-grow nc-rich-text-full': fullMode,
      'nc-rich-text-embed flex flex-col pl-1 w-full': !fullMode,
      'readonly': readOnly,
    }"
    tabindex="0"
  >
    <div
      v-if="showMenu && !readOnly"
      class="absolute top-0 right-0.5 xs:hidden"
      :class="{
        'max-w-[calc(100%_-_198px)] flex justify-end rounded-tr-2xl overflow-hidden': fullMode,
      }"
    >
      <div class="nc-scrollbar-x-md">
        <CellRichTextSelectedBubbleMenu v-if="editor" :editor="editor" embed-mode />
      </div>
    </div>
    <CellRichTextSelectedBubbleMenuPopup v-if="editor" :editor="editor" />
    <CellRichTextLinkOptions v-if="editor" :editor="editor" />
    <EditorContent
      ref="editorDom"
      :editor="editor"
      class="flex flex-col nc-textarea-rich-editor w-full"
      :class="{
        'mt-2.5 flex-grow': fullMode,
        'nc-scrollbar-md': !fullMode || (!fullMode && isExpandedFormOpen),
        'flex-grow': isExpandedFormOpen,
        [`!overflow-hidden children:line-clamp-${rowHeight}`]: !fullMode && readOnly && rowHeight && !isExpandedFormOpen,
      }"
    />
  </div>
</template>

<style lang="scss">
.nc-text-rich-scroll {
  &::-webkit-scrollbar-thumb {
    @apply bg-transparent;
  }
}
.nc-text-rich-scroll:hover {
  &::-webkit-scrollbar-thumb {
    @apply bg-gray-200;
  }
}

.nc-rich-text-embed {
  .ProseMirror {
    @apply !border-transparent max-h-full;
    min-height: 8rem;
  }
  &.readonly {
    .nc-textarea-rich-editor {
      .ProseMirror {
        resize: none;
        white-space: pre-line;
      }
    }
  }
}

.nc-rich-text-full {
  @apply px-3;
  .ProseMirror {
    @apply !p-2 h-[min(797px,100vh_-_170px)] w-[min(1256px,100vw_-_124px)];
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin !important;
    resize: both;
    min-height: 215px;
    max-height: min(797px, calc(100vh - 170px));
    min-width: 256px;
    max-width: min(1256px, 100vw - 126px);
  }
  &.readonly {
    .ProseMirror {
      @apply bg-gray-50;
    }
  }
}

.nc-textarea-rich-editor {
  .ProseMirror {
    @apply flex-grow pt-1 border-1 border-gray-200 rounded-lg;

    > * {
      @apply ml-1;
    }
  }
  .ProseMirror-focused {
    // remove all border
    outline: none;
    @apply border-brand-500;
  }

  p {
    @apply !mb-1;
  }

  ul {
    li {
      @apply ml-4;
      list-style-type: disc;
    }
  }

  ol {
    @apply -ml-6 !pl-4;
    li {
      list-style-type: decimal;
    }
  }

  ul,
  ol {
    @apply !my-0;
  }

  ul[data-type='taskList'] {
    @apply;
    li {
      @apply !ml-0 flex flex-row gap-x-2;
      list-style-type: none;

      input {
        @apply mt-0.75 flex rounded-sm;
        z-index: -10;
      }
      // Unchecked
      input:not(:checked) {
        // Add border to checkbox
        border-width: 1.5px;
        @apply border-gray-700;
      }
    }
  }

  // Pre tag is the parent wrapper for Code block
  pre {
    border-color: #d0d5dd;
    border: 1px;
    color: black;
    font-family: 'JetBrainsMono', monospace;
    padding: 1rem;
    border-radius: 0.5rem;
    @apply overflow-auto mt-3 bg-gray-100;

    code {
      @apply !px-0;
    }
  }

  code {
    @apply rounded-md px-2 py-1 bg-gray-100;
    color: inherit;
    font-size: 0.8rem;
  }

  h1 {
    font-weight: 700;
    font-size: 1.85rem;
    margin-bottom: 0.1rem;
  }

  h2 {
    font-weight: 600;
    font-size: 1.55rem;
    margin-bottom: 0.1em;
  }

  h3 {
    font-weight: 600;
    font-size: 1.15rem;
    margin-bottom: 0.1em;
  }

  blockquote {
    border-left: 3px solid #d0d5dd;
    padding: 0 1em;
    color: #666;
    margin: 1em 0;
    font-style: italic;
  }

  hr {
    @apply !border-gray-300;
    border: 0;
    border-top: 1px solid #ccc;
    margin: 1.5em 0;
  }

  pre {
    height: fit-content;
  }
}
</style>
