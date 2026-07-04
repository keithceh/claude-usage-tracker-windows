# Wiki source

These pages are the source for the [project wiki](https://github.com/keithceh/claude-usage-tracker-windows/wiki), kept in the main repo so wiki edits go through normal review.

## Publishing to the live wiki

GitHub wikis are separate git repos, created lazily: someone must create the first page once in the web UI (Wiki tab → *Create the first page* → Save anything). After that:

```bash
git clone https://github.com/keithceh/claude-usage-tracker-windows.wiki.git
cd claude-usage-tracker-windows.wiki
cp ../claude-usage-tracker-windows/wiki/*.md .   # overwrite with source pages
rm README.md                                      # this file stays in the main repo only
git add -A && git commit -m "docs: sync wiki from main repo" && git push
```

Filenames map to page titles (dashes become spaces); `_Sidebar.md` is the navigation.
