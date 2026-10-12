# Writes the service worker's precache list and build id.
import os, json, hashlib, time
root = os.path.dirname(os.path.abspath(__file__))
files = ['./']
h = hashlib.sha1()
for d, _, fs in os.walk(root):
    rel = os.path.relpath(d, root)
    if rel.startswith(('test', '.git', 'node_modules')): continue
    for f in sorted(fs):
        p = os.path.normpath(os.path.join(rel, f)).replace(os.sep, '/')
        if p in ('sw.js', 'build.py', 'README.md', '.gitignore', '.nojekyll') or p.endswith(('.wasm', '.map', '.txt', '.md')) or p.startswith(('sw.src', 'licenses/')): continue
        files.append(p)
        with open(os.path.join(root, p), 'rb') as fh: h.update(fh.read())
files.sort()
src = open(os.path.join(root, 'sw.src.js')).read()
out = src.replace('__BUILD__', h.hexdigest()[:10]).replace('__SHELL__', json.dumps(files))
open(os.path.join(root, 'sw.js'), 'w').write(out)
print(len(files), 'files, build', h.hexdigest()[:10])
