# Architecture Standards

## Component Limits
Files must not exceed 250 lines. Extract reusable UI elements to components/ui.

## Type Safety
Strict TypeScript enforcement is mandatory. The use of `any` is forbidden.

## Security
Never use `Math.random()` for tokens or OTPs; always use the native Node crypto module.

## Supabase Standards
All privileged Server Actions must route through the central `requireAdminAuth` helper function.

## Styling
No inline `<style>` blocks. Complex animations or scrollbar hiding must be placed in `app/globals.css` under the `@layer utilities` directive.
