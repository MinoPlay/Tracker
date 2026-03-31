# Copilot Instructions

## General

- Only do exactly what is asked. Do not add extra features, refactoring, comments, or improvements beyond the scope of the request.
- Keep all changes concise and minimal.
- No trailing whitespace.
## After Each Operation

After completing any requested change, provide the following git commands one per line that the user can run by clicking a button:
Update CACHE_NAME in sw.js to a new value (e.g., 'my-app-cache-v2') to invalidate the old cache and ensure users get the latest version of the app.

```
git add <modified files>
git commit -m "<meaningful message describing what was done>"
git push
```