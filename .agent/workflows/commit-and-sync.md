---
description: Commit and sync changes to the repository
---

This workflow pulls the latest changes, adds all current changes, commits them, and pushes to the remote repository.

1. Pull the latest changes to avoid conflicts.
// turbo
`git pull`

2. Add all changes to the staging area.
// turbo
`git add .`

3. Commit the changes with a message. (Use a descriptive message if one was provided in the request, otherwise use "Sync changes").
// turbo
`git commit -m "Sync changes"`

4. Push the changes to the remote repository.
// turbo
`git push`
