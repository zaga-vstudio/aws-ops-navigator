

# Remove All Lovable Branding

## Summary
Remove all Lovable logos, names, and references from the project code, replacing them with CloudHub branding where appropriate.

## Files to Modify

### 1. `index.html`
- Change `meta description` from "Lovable Generated Project" to "CloudHub - AWS Infrastructure Management"
- Change `meta author` from "Lovable" to "CloudHub"
- Update `og:description` to "CloudHub - AWS Infrastructure Management"
- Remove or replace `og:image` and `twitter:image` URLs pointing to `lovable.dev`
- Remove `twitter:site` referencing `@lovable_dev`

### 2. `README.md`
- Rewrite the README to be CloudHub-branded, removing all Lovable project links, instructions, and references

### 3. `vite.config.ts`
- Remove the `lovable-tagger` import and its usage in the plugins array

## Files NOT Modified
- `package.json` / `package-lock.json`: The `lovable-tagger` dev dependency will remain installed but unused after removing it from `vite.config.ts`. Removing it from package.json would require reinstalling dependencies which is handled separately.
- `.lovable/plan.md`: This is a Lovable system file and should not be modified.

## Technical Details
- The `componentTagger` from `lovable-tagger` is only used in development mode and tags components for Lovable's editor. Removing it has zero impact on the app.
- The OG/Twitter meta images currently point to Lovable's default opengraph image. These will be cleared or pointed to a placeholder.

