# Automated User Guide and UAT Documentation

This folder contains a dependency-free documentation generator for the AlSafwa Cement Portal. It treats files in `documentation/screenshots/` as real application evidence and never creates or substitutes screenshots.

## Folder structure

```text
documentation/
├── screenshots/                    # Original application screenshots (source evidence)
├── generated/                      # Generated Markdown and print-ready HTML
└── user-guide/
    ├── generate-user-guide.mjs      # Generator
    ├── user-guide.config.json       # Guide sections, captions, scope and UAT cases
    └── README.md                    # Authoring instructions
```

## Generate the documents

From the repository root:

```bash
npm run docs:generate
```

The command creates:

```text
documentation/generated/AlSafwa_Cement_Portal_User_Guide_and_UAT.md
documentation/generated/AlSafwa_Cement_Portal_User_Guide_and_UAT.html
```

Open the HTML file in a browser for client review or use the browser's **Print → Save as PDF** option for a shareable PDF. The Markdown file remains the editable, repository-friendly output.

## Add screenshots later

1. Add the real application screenshot to `documentation/screenshots/`.
2. Use a unique numeric prefix so evidence order is deterministic, for example:

   ```text
   13_customer_login.png
   14_customer_dashboard.png
   ```

3. Preserve the filename after it has been referenced in UAT evidence.
4. Extend the relevant section's numeric `screenshotRange` in `user-guide.config.json`:

   ```json
   "screenshotRange": [13, 28]
   ```

5. Run `npm run docs:generate` again.

The generator discovers supported `.png`, `.jpg`, `.jpeg`, and `.webp` files, sorts them by numeric filename prefix, preserves each filename, and creates a professional caption from it. A discovered file outside all configured ranges is listed under **Evidence Awaiting Classification**. It is not presented as proof of completed functionality.

## Add or update a guide section

Edit the `sections` collection in `user-guide.config.json`. Each section supports:

- `id`: stable unique identifier;
- `title`: client-facing heading;
- `audience`: intended user role;
- `summary`: verified purpose of the area;
- `steps`: ordered operating instructions;
- `screenshotRange`: inclusive numeric filename-prefix range assigned to the section.

Sections without mapped screenshots are retained as controlled placeholders and clearly state that detailed evidence has not yet been mapped.

## Add a UAT case

Add an entry to `uatCases` in `user-guide.config.json`:

```json
{
  "id": "UAT-CUS-002",
  "role": "Activated customer user",
  "module": "Login & Access",
  "scenario": "Sign in through the shared Customer Portal login.",
  "expectedResult": "The authenticated Customer Portal opens with role-permitted navigation."
}
```

New UAT cases default to `NOT TESTED` in the generated document. Invalid screenshot mappings stop generation with a clear message.

## Scope control

Maintain `implementedAreas` and `pendingAreas` in the configuration. Pending or unverified features must remain in the pending list until their implementation and screenshots have been confirmed. Do not use planned mockups, fabricated records, credentials, or generated screenshots as application evidence.

## Table of contents and evidence register

The generator builds the Table of Contents from the headings used in the generated document. It also creates a screenshot evidence register containing the discovered order, original filename, and mapped guide section.
