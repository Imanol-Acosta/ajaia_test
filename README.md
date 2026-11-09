# Folio

Folio is a small document workspace built for the Ajaia product engineering exercise. Create a draft, format and save it, or import a plain-text file. Share a saved document with another demo account as a Viewer or Editor.

[Open the live Folio demo](https://ajaia-test.ilacosta05.workers.dev/)

## Run locally

Extract `Folio-source.zip`, open a terminal in the extracted folder, and use Node.js 22.12 or newer with npm. The demo credentials are in `DEMO-ACCOUNTS.md` in the Drive folder.

```sh
npm ci
```

Create a file named `.env` beside `package.json` and add the public configuration for the Ajaia demo:

```dotenv
VITE_SUPABASE_URL=https://dtjslwptjpastcxfjliq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ntNfCxKhSlYksx93Z29Zcw_ZEHFZARQ
```

Start the development server and open the URL Vite prints.

```sh
npm run dev
```

Use the same two demo accounts for the local app. To run against a separate database, follow **Provision another Supabase project** below and use that project's URL and publishable key.

## Review the flow

1. Sign in as Riley. Create a document named **PC Parts** and type `Build notes CPU and motherboard`. Select only `CPU and motherboard` and apply **Heading 1**. The selected phrase becomes a heading while `Build notes` stays a paragraph. Add a list and some bold or underlined text, select **Save**, then reload to see the saved formatting.
2. As Riley, select **Import .txt** from the workspace. Use a UTF-8 `.txt` file up to **64 KiB**. The filename becomes the initial title, and the text opens as a new editable document.
3. Copy the document URL. In a separate browser profile or incognito window, sign in as Morgan. The URL should show **Document unavailable** before Riley shares it.
4. As Riley, open **Share**, select Morgan, choose **Viewer**, and select **Grant access**. As Morgan, retry the direct URL and check that the document opens as **Read only**.
5. As Riley, change Morgan's access to **Editor** and select **Save access**. As Morgan, reload, edit and save the document, then reload as Riley to see the changes. Only Riley can manage access.
6. Optional manual concurrency check. Open the same document as Riley and Morgan while Morgan has Editor access. Save in one session and then try saving from the older session. The older draft should stay visible and the save should report a conflict.
7. With a disposable document, use the trash button under **My documents**. Cancel once, then confirm. The document should disappear from both accounts after refresh, and its direct URL should show **Document unavailable**.

To check numbering with soft line breaks, type `CPU`, `Motherboard`, `RAM`, and `Graphics card` on separate lines using **Shift+Enter**. Select the four lines and click **Numbered list**. Each line should receive its own number. You can use the same action on a selected item that already contains several lines.

## Automated test and build

```sh
npm test
npm run build
```

The Vitest case in `src/documents.test.ts` checks that a UTF-8 import preserves blank lines and stores markup-like input as literal text. The build runs TypeScript checking and writes the static site to `dist`.

The app validates document titles and accepts nonempty UTF-8 `.txt` files up to 64 KiB. Failed saves leave the draft visible so the author can retry or copy their changes.

## Provision another Supabase project

1. Run `npx supabase login` and `npx supabase link --project-ref YOUR_PROJECT_REF`. Use a dedicated hosted project and run `npx supabase db push --remote --dry-run`, then `npx supabase db push --remote`.
2. In **Authentication → Users**, create and confirm two email/password users. Copy their user IDs. Use dedicated demo identities and demo data.
3. In the project's SQL Editor, register their display names in the sharing directory:

```sql
insert into public.demo_people (id, display_name)
values
  ('RILEY_AUTH_USER_UUID', 'Riley'),
  ('MORGAN_AUTH_USER_UUID', 'Morgan');
```

## Deployment

The live demo is hosted on Cloudflare Workers. In Workers Builds, set both `VITE_SUPABASE_*` variables in the build environment for the production branch and use `npm run build` as the build command. Deploy `dist` as static assets. Set `assets.not_found_handling` to `single-page-application` so direct document links load the React app. Start a fresh build after changing the variables. [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) · [SPA routing on Workers](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)

See [ARCHITECTURE.md](ARCHITECTURE.md) and [AI-WORKFLOW.md](AI-WORKFLOW.md) for tradeoffs and review notes.
