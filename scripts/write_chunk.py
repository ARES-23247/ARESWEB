import sys
mode = sys.argv[1] # 'w' or 'a'
path = sys.argv[2]
content = sys.stdin.read()
with open(path, mode, encoding='utf-8') as out:
    out.write(content)
print(f'Wrote {len(content)} chars to {path}')
