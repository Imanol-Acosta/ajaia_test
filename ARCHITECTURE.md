# Architecture

Folio uses React and Tiptap in a static Vite build served by Cloudflare Workers. Supabase handles authentication, persistence, and authorization. I prioritized a complete flow from opening a draft to saving and sharing it. That kept the frontend deployment simple and put access enforcement in the database, where it also applies to requests made directly to the API.

## Documents and saving

`documents` stores the owner, title, Tiptap JSON, revision, and last update time. Tiptap restores the same document structure when it opens the saved JSON. An explicit **Save** sends the title and content in one update. The request includes the last observed revision, and a database trigger increments the revision on every update. An older tab cannot silently overwrite a newer save. Failed saves leave the draft in the open editor.

Text import reads a bounded UTF-8 file in the browser and converts each line into a paragraph. It creates a regular document in one insert. The imported text is handled as text nodes, including anything that looks like markup.

## Access

Supabase Auth supplies the user ID. RLS allows the owner and shared Editors to read and update the title and content. Viewers can read the document. The owner can grant or change a role through a single upsert that runs with the caller's privileges. A composite foreign key ties the share to the document owner without recursive RLS. Existing shares default to Viewer, and only the access role can change on an existing grant.

Owners can permanently delete their documents from the workspace. The database restricts deletion to the owner and removes all grants for that document through the existing foreign key.

## Scope and next steps

**Working.** Create, rename, format, save, reopen, and import a plain-text document. Grant Viewer or Editor access, change the role, and permanently delete owned documents. Shared edits use the same revision check as owner edits.

**Limits.** Saving is explicit, and an unsaved draft lives in memory. The import workflow is limited to plain-text UTF-8. Simultaneous edits surface a conflict at save time. Live co-editing, version history, and removing a single recipient's access are future work.

**With another 2–4 hours.** Add per-recipient access removal and a database test that exercises owner, Viewer, and Editor permissions directly.
