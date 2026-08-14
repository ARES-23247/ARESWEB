import sys, os

if len(sys.argv) < 3:
    print('Usage: python write_file_helper.py <target_path> <source_path>')
    sys.exit(1)

target_path = sys.argv[1]
source_path = sys.argv[2]

os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)
with open(source_path, 'r', encoding='utf-8') as src:
    content = src.read()

with open(target_path, 'w', encoding='utf-8') as dst:
    dst.write(content)

print(f'Successfully wrote {len(content)} chars to {target_path}')
